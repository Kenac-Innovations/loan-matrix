import assert from "node:assert/strict";
import test from "node:test";

import {
  registerArdaStockReportsWithFineractApi,
} from "../arda-stock-report-api-registration";
import { ARDA_STOCK_REPORT_NAMES } from "../fineract-arda-stock-reports";
import type { FineractRequester } from "../fineract-arda-stock-details";

type Report = {
  id: number;
  reportName: string;
  reportSql: string;
  reportParameters: Array<{
    id: number;
    parameterId: number;
    reportParameterName: string;
  }>;
};

function createHarness(existingReports: Report[] = []) {
  const reports = structuredClone(existingReports);
  const calls: Array<{ endpoint: string; method: string; body?: unknown }> = [];
  let nextReportId = 700;

  const request: FineractRequester = async (endpoint, options = {}) => {
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(String(options.body)) : undefined;
    calls.push({ endpoint, method, body });

    if (endpoint === "/datatables" && method === "POST") {
      return { resourceIdentifier: "arda_stock_details" };
    }
    if (endpoint === "/reports" && method === "GET") {
      return reports.map(({ id, reportName }) => ({ id, reportName }));
    }
    if (endpoint === "/reports" && method === "POST") {
      const id = nextReportId++;
      reports.push({
        ...body,
        id,
        reportParameters: body.reportParameters.map(
          (parameter: Record<string, unknown>, index: number) => ({
            ...parameter,
            id: id * 10 + index,
          })
        ),
      });
      return { resourceId: id };
    }
    const reportMatch = endpoint.match(/^\/reports\/(\d+)$/);
    if (reportMatch && method === "GET") {
      return structuredClone(
        reports.find((report) => report.id === Number(reportMatch[1]))
      );
    }
    if (reportMatch && method === "PUT") {
      const index = reports.findIndex(
        (report) => report.id === Number(reportMatch[1])
      );
      reports[index] = { ...reports[index], ...body };
      return { resourceId: reports[index].id };
    }
    if (endpoint.startsWith("/runreports/FullParameterList")) {
      const name = ARDA_STOCK_REPORT_NAMES.find((reportName) =>
        endpoint.includes(encodeURIComponent(`'${reportName}'`))
      );
      const report = reports.find((candidate) => candidate.reportName === name);
      return {
        data: (report?.reportParameters || []).map((parameter) => ({
          row: ["parameter", parameter.reportParameterName],
        })),
      };
    }
    throw new Error(`Unexpected request: ${method} ${endpoint}`);
  };

  return { calls, reports, request };
}

const enabledSettings = { features: { ardaStockReports: true } };

test("creates the ARDA data table and reports through the Fineract API", async () => {
  const harness = createHarness();

  const result = await registerArdaStockReportsWithFineractApi({
    tenantSlug: "arda",
    tenantSettings: enabledSettings,
    fineractTenantId: "arda",
    request: harness.request,
  });

  assert.deepEqual(result.created, [...ARDA_STOCK_REPORT_NAMES]);
  assert.deepEqual(result.updated, []);
  assert.equal(
    harness.calls.filter(
      (call) => call.endpoint === "/datatables" && call.method === "POST"
    ).length,
    1
  );
  assert.equal(
    harness.calls.filter(
      (call) => call.endpoint === "/reports" && call.method === "POST"
    ).length,
    3
  );
  for (const report of harness.reports) {
    assert.deepEqual(
      report.reportParameters.map((parameter) => parameter.reportParameterName),
      ["startDate", "endDate", "officeId", "currencyId", "loanProductId"]
    );
    assert.doesNotMatch(report.reportSql, /\$\{stockItemId\}/);
  }
});

test("updates matching ARDA report IDs without creating duplicates", async () => {
  const existing = ARDA_STOCK_REPORT_NAMES.map((reportName, index) => ({
    id: 100 + index,
    reportName,
    reportSql: "SELECT 1",
    reportParameters: [1, 2, 5, 10, 25].map((parameterId, parameterIndex) => ({
      id: 1000 + index * 10 + parameterIndex,
      parameterId,
      reportParameterName: [
        "startDate",
        "endDate",
        "officeId",
        "currencyId",
        "loanProductId",
      ][parameterIndex],
    })),
  }));
  const harness = createHarness(existing);

  const result = await registerArdaStockReportsWithFineractApi({
    tenantSlug: "arda",
    tenantSettings: enabledSettings,
    fineractTenantId: "arda",
    request: harness.request,
  });

  assert.deepEqual(result.created, []);
  assert.deepEqual(result.updated, [...ARDA_STOCK_REPORT_NAMES]);
  assert.equal(
    harness.calls.filter((call) => call.method === "PUT").length,
    3
  );
  assert.equal(
    harness.calls.filter(
      (call) => call.endpoint === "/reports" && call.method === "POST"
    ).length,
    0
  );
  assert.ok(harness.reports.every((report) => report.reportSql !== "SELECT 1"));
});

test("rejects non-ARDA or disabled targets before calling Fineract", async () => {
  const harness = createHarness();

  await assert.rejects(
    registerArdaStockReportsWithFineractApi({
      tenantSlug: "goodfellow",
      tenantSettings: enabledSettings,
      fineractTenantId: "arda",
      request: harness.request,
    }),
    /ARDA stock reports are not enabled/i
  );
  await assert.rejects(
    registerArdaStockReportsWithFineractApi({
      tenantSlug: "arda",
      tenantSettings: enabledSettings,
      fineractTenantId: "goodfellow",
      request: harness.request,
    }),
    /Fineract tenant must be arda/i
  );
  assert.equal(harness.calls.length, 0);
});
