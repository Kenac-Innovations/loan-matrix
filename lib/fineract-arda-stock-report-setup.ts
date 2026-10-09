import {
  ARDA_STOCK_DETAILS_TABLE,
  ensureArdaStockDetailsDatatable,
  type FineractRequester,
} from "@/lib/fineract-arda-stock-details";
import {
  ARDA_STOCK_ITEM_OPTIONS_REPORT,
  ARDA_STOCK_REPORT_NAMES,
  buildArdaStockReportDefinitions,
  type FineractReportDefinition,
} from "@/lib/fineract-arda-stock-reports";

export type ArdaTenantRecord = {
  id: string;
  slug: string;
  settings: unknown;
};

export type ArdaLoanMatrixClient = {
  getTenantBySlug(slug: string): Promise<ArdaTenantRecord | null>;
  updateTenantSettings(id: string, settings: Record<string, unknown>): Promise<void>;
};

export type ArdaStockCatalogClient = {
  getStockItemParameterId(): Promise<number | null>;
  upsertStockItemParameter(): Promise<number>;
};

export type ArdaStockReportSetupOptions = {
  tenantSlug: string;
  fineractTenantId: string;
  fineractDatabaseName: string;
  roleIds: number[];
  apply?: boolean;
  loanMatrix: ArdaLoanMatrixClient;
  catalog: ArdaStockCatalogClient;
  fineract: FineractRequester;
};

export type ArdaStockReportSetupResult = {
  mode: "preview" | "applied";
  tenantSlug: "arda";
  fineractDatabaseName: "fineract_tenant_arda";
  tenantSettings: ArdaMergedSettings;
  dataTable: typeof ARDA_STOCK_DETAILS_TABLE;
  selectorReport: typeof ARDA_STOCK_ITEM_OPTIONS_REPORT;
  parameter: {
    variable: "stockItemId";
    label: "Stock Item";
    displayType: "select";
    selectAll: "Y";
    parameterName: typeof ARDA_STOCK_ITEM_OPTIONS_REPORT;
  };
  parameterId?: number;
  reports: string[];
  roleIds: number[];
  permissions?: string[];
};

type FineractReportSummary = { id: number; reportName: string };
type PermissionUsage = { code?: string; selected?: boolean };
type JsonObject = Record<string, unknown>;
type ArdaMergedSettings = JsonObject & {
  features: JsonObject & { ardaStockReports: true };
};

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function mergeArdaStockReportSetting(
  settings: unknown
): ArdaMergedSettings {
  const merged = objectValue(settings);
  merged.features = {
    ...objectValue(merged.features),
    ardaStockReports: true,
  };
  return merged as ArdaMergedSettings;
}

function validateApplyTarget(options: ArdaStockReportSetupOptions): void {
  if (options.tenantSlug.trim().toLowerCase() !== "arda") {
    throw new Error("The apply tenant must be arda.");
  }
  if (options.fineractDatabaseName !== "fineract_tenant_arda") {
    throw new Error("Apply requires the fineract_tenant_arda database.");
  }
  if (options.fineractTenantId.trim().toLowerCase() !== "arda") {
    throw new Error("The Fineract tenant must be arda.");
  }
  if (
    options.roleIds.length === 0 ||
    options.roleIds.some((roleId) => !Number.isInteger(roleId) || roleId <= 0)
  ) {
    throw new Error("At least one positive ARDA role ID is required.");
  }
}

function reportPayload(report: FineractReportDefinition) {
  return {
    reportName: report.reportName,
    reportType: report.reportType,
    reportSubType: report.reportSubType,
    reportCategory: report.reportCategory,
    description: report.description,
    useReport: report.useReport,
    reportSql: report.reportSql,
    ...(report.reportParameters
      ? { reportParameters: report.reportParameters }
      : {}),
  };
}

async function upsertReport(
  request: FineractRequester,
  report: FineractReportDefinition,
  reportsByName: Map<string, FineractReportSummary>
): Promise<void> {
  const existing = reportsByName.get(report.reportName);
  if (existing) {
    const current = (await request(`/reports/${existing.id}`, {
      authMode: "service",
      cache: "no-store",
    })) as { reportParameters?: Array<{ id?: number; parameterId?: number }> };
    const currentParameterIds = new Map(
      (current?.reportParameters || []).map((parameter) => [
        parameter.parameterId,
        parameter.id,
      ])
    );
    const payload = reportPayload({
      ...report,
      ...(report.reportParameters
        ? {
            reportParameters: report.reportParameters.map((parameter) => ({
              ...parameter,
              ...(currentParameterIds.get(parameter.parameterId)
                ? { id: currentParameterIds.get(parameter.parameterId) }
                : {}),
            })),
          }
        : {}),
    } as FineractReportDefinition);
    await request(`/reports/${existing.id}`, {
      method: "PUT",
      authMode: "service",
      body: JSON.stringify(payload),
    });
    return;
  }

  const payload = reportPayload(report);
  const created = (await request("/reports", {
    method: "POST",
    authMode: "service",
    body: JSON.stringify(payload),
  })) as { resourceId?: number };
  if (!Number.isInteger(created?.resourceId)) {
    throw new Error(`Fineract did not return an ID for ${report.reportName}.`);
  }
  reportsByName.set(report.reportName, {
    id: created.resourceId as number,
    reportName: report.reportName,
  });
}

function normalizedPermission(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function resolveReportPermissions(
  permissions: unknown,
  reportNames: readonly string[]
): string[] {
  const entries = Array.isArray(permissions) ? permissions : [];
  const codes = entries
    .map((entry) => String((entry as { code?: unknown })?.code || ""))
    .filter(Boolean);

  return reportNames.map((reportName) => {
    const expected = normalizedPermission(`READ_${reportName}`);
    const code = codes.find(
      (candidate) => normalizedPermission(candidate) === expected
    );
    if (!code) {
      throw new Error(
        `Fineract did not generate the read permission for ${reportName}.`
      );
    }
    return code;
  });
}

function permissionUsage(value: unknown): PermissionUsage[] {
  if (!value || typeof value !== "object") return [];
  const usage = (value as { permissionUsageData?: unknown }).permissionUsageData;
  return Array.isArray(usage) ? (usage as PermissionUsage[]) : [];
}

async function grantReportPermissions(
  request: FineractRequester,
  roleIds: number[],
  reportPermissions: string[]
): Promise<void> {
  for (const roleId of roleIds) {
    const current = await request(`/roles/${roleId}/permissions`, {
      authMode: "service",
      cache: "no-store",
    });
    const permissions: Record<string, boolean> = {};
    for (const usage of permissionUsage(current)) {
      if (usage.code && usage.selected === true) permissions[usage.code] = true;
    }
    for (const code of reportPermissions) permissions[code] = true;

    await request(`/roles/${roleId}/permissions`, {
      method: "PUT",
      authMode: "service",
      body: JSON.stringify({ permissions }),
    });
  }
}

async function verifyAppliedSetup(input: {
  options: ArdaStockReportSetupOptions;
  parameterId: number;
  reportPermissions: string[];
}): Promise<ArdaMergedSettings> {
  const { options } = input;
  const tenant = await options.loanMatrix.getTenantBySlug("arda");
  const settings = objectValue(tenant?.settings);
  if (objectValue(settings.features).ardaStockReports !== true) {
    throw new Error("The ARDA tenant feature setting was not saved.");
  }

  const tables = await options.fineract("/datatables?apptable=m_loan", {
    authMode: "service",
    cache: "no-store",
  });
  if (
    !Array.isArray(tables) ||
    !tables.some((table) => {
      const record = table as Record<string, unknown>;
      return [record.registeredTableName, record.datatableName, record.name]
        .map(String)
        .includes(ARDA_STOCK_DETAILS_TABLE);
    })
  ) {
    throw new Error("The ARDA stock details data table was not registered.");
  }

  const reports = (await options.fineract("/reports", {
    authMode: "service",
    cache: "no-store",
  })) as FineractReportSummary[];
  const requiredNames = [ARDA_STOCK_ITEM_OPTIONS_REPORT, ...ARDA_STOCK_REPORT_NAMES];
  for (const name of requiredNames) {
    if (!reports.some((report) => report.reportName === name)) {
      throw new Error(`The Fineract report ${name} is missing after setup.`);
    }

    const parameters = await options.fineract(
      `/runreports/FullParameterList?R_reportListing=${encodeURIComponent(`'${name}'`)}&parameterType=true`,
      { authMode: "service", cache: "no-store" }
    );
    if (
      name !== ARDA_STOCK_ITEM_OPTIONS_REPORT &&
      (!Array.isArray(parameters) ||
        !parameters.some(
          (parameter) =>
            (parameter as { parameter_variable?: unknown }).parameter_variable ===
            "stockItemId"
        ))
    ) {
      throw new Error(`${name} is missing its Stock Item parameter.`);
    }
  }

  for (const roleId of options.roleIds) {
    const role = await options.fineract(`/roles/${roleId}/permissions`, {
      authMode: "service",
      cache: "no-store",
    });
    const selected = new Set(
      permissionUsage(role)
        .filter((usage) => usage.selected === true)
        .map((usage) => usage.code)
    );
    for (const code of input.reportPermissions) {
      if (!selected.has(code)) {
        throw new Error(`Role ${roleId} is missing permission ${code}.`);
      }
    }
  }

  const catalogParameterId = await options.catalog.getStockItemParameterId();
  if (catalogParameterId !== input.parameterId) {
    throw new Error("The Stock Item parameter ID did not survive read-back.");
  }
  return settings as ArdaMergedSettings;
}

export async function setupArdaStockReports(
  options: ArdaStockReportSetupOptions
): Promise<ArdaStockReportSetupResult> {
  const previewTenant = await options.loanMatrix.getTenantBySlug("arda");
  if (!previewTenant) throw new Error("The Loan Matrix ARDA tenant was not found.");

  const tenantSettings = mergeArdaStockReportSetting(previewTenant.settings);
  const roleIds = Array.from(new Set(options.roleIds));
  const resultBase = {
    tenantSlug: "arda" as const,
    fineractDatabaseName: "fineract_tenant_arda" as const,
    tenantSettings,
    dataTable: ARDA_STOCK_DETAILS_TABLE as typeof ARDA_STOCK_DETAILS_TABLE,
    selectorReport:
      ARDA_STOCK_ITEM_OPTIONS_REPORT as typeof ARDA_STOCK_ITEM_OPTIONS_REPORT,
    parameter: {
      variable: "stockItemId" as const,
      label: "Stock Item" as const,
      displayType: "select" as const,
      selectAll: "Y" as const,
      parameterName:
        ARDA_STOCK_ITEM_OPTIONS_REPORT as typeof ARDA_STOCK_ITEM_OPTIONS_REPORT,
    },
    reports: [...ARDA_STOCK_REPORT_NAMES],
    roleIds,
  };

  if (!options.apply) return { mode: "preview", ...resultBase };
  validateApplyTarget({ ...options, roleIds });

  await options.loanMatrix.updateTenantSettings(previewTenant.id, tenantSettings);
  await ensureArdaStockDetailsDatatable({
    appTenantSlug: "arda",
    tenantSettings,
    fineractTenantId: "arda",
    request: options.fineract,
  });

  const existingReports = (await options.fineract("/reports", {
    authMode: "service",
    cache: "no-store",
  })) as FineractReportSummary[];
  const reportsByName = new Map(
    existingReports.map((report) => [report.reportName, report])
  );
  const provisionalDefinitions = buildArdaStockReportDefinitions(1);
  await upsertReport(
    options.fineract,
    provisionalDefinitions[0],
    reportsByName
  );

  const parameterId = await options.catalog.upsertStockItemParameter();
  if (!Number.isInteger(parameterId) || parameterId <= 0) {
    throw new Error("The Stock Item catalog parameter did not return a valid ID.");
  }
  const definitions = buildArdaStockReportDefinitions(parameterId);
  for (const report of definitions.slice(1)) {
    await upsertReport(options.fineract, report, reportsByName);
  }

  const availablePermissions = await options.fineract("/permissions", {
    authMode: "service",
    cache: "no-store",
  });
  const reportPermissions = resolveReportPermissions(
    availablePermissions,
    ARDA_STOCK_REPORT_NAMES
  );
  await grantReportPermissions(options.fineract, roleIds, reportPermissions);

  const verifiedSettings = await verifyAppliedSetup({
    options: { ...options, roleIds },
    parameterId,
    reportPermissions,
  });

  return {
    mode: "applied",
    ...resultBase,
    tenantSettings: verifiedSettings,
    parameterId,
    permissions: reportPermissions,
  };
}
