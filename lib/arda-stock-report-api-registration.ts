import { extractReportParameterVariables } from "@/lib/arda-stock-report-verification";
import {
  ensureArdaStockDetailsDatatable,
  type FineractRequester,
} from "@/lib/fineract-arda-stock-details";
import {
  ARDA_STOCK_REPORT_NAMES,
  buildArdaStockReportApiDefinitions,
  type FineractReportDefinition,
} from "@/lib/fineract-arda-stock-reports";

type FineractReportSummary = { id: number; reportName: string };

export type ArdaStockReportApiRegistrationOptions = {
  tenantSlug: string;
  tenantSettings: unknown;
  fineractTenantId: string;
  request: FineractRequester;
};

export type ArdaStockReportApiRegistrationResult = {
  dataTable: "created" | "exists";
  created: string[];
  updated: string[];
};

const REQUIRED_PARAMETERS = [
  "startDate",
  "endDate",
  "officeId",
  "currencyId",
  "loanProductId",
];

function reportPayload(report: FineractReportDefinition) {
  return {
    reportName: report.reportName,
    reportType: report.reportType,
    reportSubType: report.reportSubType,
    reportCategory: report.reportCategory,
    description: report.description,
    useReport: report.useReport,
    reportSql: report.reportSql,
    reportParameters: report.reportParameters,
  };
}

async function updateReport(
  request: FineractRequester,
  reportId: number,
  report: FineractReportDefinition
): Promise<void> {
  const current = (await request(`/reports/${reportId}`, {
    authMode: "service",
    cache: "no-store",
  })) as { reportParameters?: Array<{ id?: number; parameterId?: number }> };
  const currentParameterIds = new Map(
    (current.reportParameters || []).map((parameter) => [
      parameter.parameterId,
      parameter.id,
    ])
  );
  const parameters = (report.reportParameters || []).map((parameter) => ({
    ...parameter,
    ...(currentParameterIds.get(parameter.parameterId)
      ? { id: currentParameterIds.get(parameter.parameterId) }
      : {}),
  }));

  await request(`/reports/${reportId}`, {
    method: "PUT",
    authMode: "service",
    body: JSON.stringify({ ...reportPayload(report), reportParameters: parameters }),
  });
}

async function verifyReports(
  request: FineractRequester,
  definitions: FineractReportDefinition[]
): Promise<void> {
  const reports = (await request("/reports", {
    authMode: "service",
    cache: "no-store",
  })) as FineractReportSummary[];

  for (const definition of definitions) {
    const report = reports.find(
      (candidate) => candidate.reportName === definition.reportName
    );
    if (!report) {
      throw new Error(`Fineract did not retain ${definition.reportName}.`);
    }

    const detail = (await request(`/reports/${report.id}`, {
      authMode: "service",
      cache: "no-store",
    })) as { reportSql?: unknown };
    const sql = String(detail.reportSql || "");
    for (const parameter of ["startDate", "endDate", "officeId"]) {
      if (!sql.includes(`\${${parameter}}`)) {
        throw new Error(`${definition.reportName} is missing its ${parameter} SQL filter.`);
      }
    }
    if (
      definition.reportName !== ARDA_STOCK_REPORT_NAMES[2] &&
      !/AS ["`]Client Name["`]/i.test(sql)
    ) {
      throw new Error(`${definition.reportName} is missing its Client Name column.`);
    }

    const parameters = await request(
      `/runreports/FullParameterList?R_reportListing=${encodeURIComponent(`'${definition.reportName}'`)}&parameterType=true`,
      { authMode: "service", cache: "no-store" }
    );
    const variables = new Set(extractReportParameterVariables(parameters));
    for (const required of REQUIRED_PARAMETERS) {
      if (!variables.has(required)) {
        throw new Error(`${definition.reportName} is missing parameter ${required}.`);
      }
    }
  }
}

export async function registerArdaStockReportsWithFineractApi(
  options: ArdaStockReportApiRegistrationOptions
): Promise<ArdaStockReportApiRegistrationResult> {
  const dataTable = await ensureArdaStockDetailsDatatable({
    appTenantSlug: options.tenantSlug,
    tenantSettings: options.tenantSettings,
    fineractTenantId: options.fineractTenantId,
    request: options.request,
  });
  const definitions = buildArdaStockReportApiDefinitions();
  const existingReports = (await options.request("/reports", {
    authMode: "service",
    cache: "no-store",
  })) as FineractReportSummary[];
  const reportsByName = new Map(
    existingReports.map((report) => [report.reportName, report])
  );
  const created: string[] = [];
  const updated: string[] = [];

  for (const definition of definitions) {
    const existing = reportsByName.get(definition.reportName);
    if (existing) {
      await updateReport(options.request, existing.id, definition);
      updated.push(definition.reportName);
      continue;
    }

    const response = (await options.request("/reports", {
      method: "POST",
      authMode: "service",
      body: JSON.stringify(reportPayload(definition)),
    })) as { resourceId?: unknown };
    if (!Number.isInteger(response.resourceId)) {
      throw new Error(
        `Fineract did not return an ID for ${definition.reportName}.`
      );
    }
    created.push(definition.reportName);
  }

  await verifyReports(options.request, definitions);
  return { dataTable, created, updated };
}
