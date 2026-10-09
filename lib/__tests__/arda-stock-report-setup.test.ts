import assert from "node:assert/strict";
import test from "node:test";

import {
  setupArdaStockReports,
  type ArdaLoanMatrixClient,
  type ArdaStockCatalogClient,
  type ArdaStockReportSetupOptions,
} from "../fineract-arda-stock-report-setup";
import {
  ARDA_STOCK_ITEM_OPTIONS_REPORT,
  ARDA_STOCK_REPORT_NAMES,
} from "../fineract-arda-stock-reports";

type ApiCall = { endpoint: string; method: string; body?: any };

function createHarness(existingReportNames: string[] = []) {
  const tenant = {
    id: "tenant-arda",
    slug: "arda",
    settings: {
      theme: "forest",
      integrations: { sms: true },
      features: { reports: true, notifications: true },
    },
  };
  const tenantReads: string[] = [];
  const tenantWrites: Array<{ id: string; settings: unknown }> = [];
  const loanMatrix: ArdaLoanMatrixClient = {
    getTenantBySlug: async (slug) => {
      tenantReads.push(slug);
      return slug === "arda" ? structuredClone(tenant) : null;
    },
    updateTenantSettings: async (id, settings) => {
      tenantWrites.push({ id, settings });
      tenant.settings = structuredClone(settings) as typeof tenant.settings;
    },
  };

  let parameterId = 9401;
  let catalogWrites = 0;
  const catalog: ArdaStockCatalogClient = {
    getStockItemParameterId: async () => parameterId,
    upsertStockItemParameter: async () => {
      catalogWrites += 1;
      return parameterId;
    },
  };

  let nextReportId = 100;
  const reports: any[] = existingReportNames.map((reportName) => ({
    id: nextReportId++,
    reportName,
    reportParameters:
      reportName === ARDA_STOCK_ITEM_OPTIONS_REPORT
        ? []
        : [1, 2, 5, 10, 25, parameterId].map((parameterIdValue, index) => ({
            id: 5000 + index,
            parameterId: parameterIdValue,
            reportParameterName:
              ["startDate", "endDate", "officeId", "currencyId", "loanProductId", "stockItemId"][index],
          })),
  }));
  const rolePermissions = new Map<number, Set<string>>([
    [7, new Set(["READ_LOAN"])],
    [8, new Set(["CREATE_CLIENT"])],
  ]);
  const reportPermissionCodes = ARDA_STOCK_REPORT_NAMES.map(
    (name) => `READ_${name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`
  );
  const apiCalls: ApiCall[] = [];
  let datatableCreated = false;

  const fineract = async (endpoint: string, options: any = {}) => {
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : undefined;
    apiCalls.push({ endpoint, method, body });

    if (endpoint === "/reports" && method === "GET") {
      return structuredClone(reports);
    }
    if (endpoint === "/reports" && method === "POST") {
      const report = { id: nextReportId++, reportName: body.reportName };
      reports.push(report);
      return { resourceId: report.id };
    }
    const reportGetMatch = endpoint.match(/^\/reports\/(\d+)$/);
    if (reportGetMatch && method === "GET") {
      return structuredClone(
        reports.find((report) => report.id === Number(reportGetMatch[1]))
      );
    }
    if (/^\/reports\/\d+$/.test(endpoint) && method === "PUT") {
      return { resourceId: Number(endpoint.split("/").pop()) };
    }
    if (endpoint === "/datatables" && method === "POST") {
      datatableCreated = true;
      return { resourceIdentifier: "arda_stock_details" };
    }
    if (endpoint === "/datatables?apptable=m_loan" && method === "GET") {
      return datatableCreated
        ? [{ registeredTableName: "arda_stock_details" }]
        : [];
    }
    if (endpoint.startsWith("/runreports/FullParameterList")) {
      const isSelector = endpoint.includes(
        encodeURIComponent(`'${ARDA_STOCK_ITEM_OPTIONS_REPORT}'`)
      );
      return isSelector
        ? []
        : [
            { parameter_variable: "startDate" },
            { parameter_variable: "endDate" },
            { parameter_variable: "officeId" },
            { parameter_variable: "currencyId" },
            { parameter_variable: "loanProductId" },
            { parameter_variable: "stockItemId" },
          ];
    }
    if (endpoint === "/permissions" && method === "GET") {
      return reportPermissionCodes.map((code) => ({ code }));
    }
    const roleMatch = endpoint.match(/^\/roles\/(\d+)\/permissions$/);
    if (roleMatch && method === "GET") {
      const roleId = Number(roleMatch[1]);
      const selected = rolePermissions.get(roleId) ?? new Set<string>();
      return {
        permissionUsageData: [
          ...Array.from(selected).map((code) => ({ code, selected: true })),
          ...reportPermissionCodes
            .filter((code) => !selected.has(code))
            .map((code) => ({ code, selected: false })),
        ],
      };
    }
    if (roleMatch && method === "PUT") {
      const roleId = Number(roleMatch[1]);
      const selected = new Set(
        Object.entries(body.permissions)
          .filter(([, enabled]) => enabled === true || enabled === "true")
          .map(([code]) => code)
      );
      rolePermissions.set(roleId, selected);
      return { resourceId: roleId };
    }
    throw new Error(`Unexpected Fineract request: ${method} ${endpoint}`);
  };

  const options: ArdaStockReportSetupOptions = {
    tenantSlug: "arda",
    fineractTenantId: "arda",
    fineractDatabaseName: "fineract_tenant_arda",
    roleIds: [7, 8],
    apply: true,
    loanMatrix,
    catalog,
    fineract,
  };

  return {
    options,
    tenantReads,
    tenantWrites,
    apiCalls,
    rolePermissions,
    catalogWrites: () => catalogWrites,
    setParameterId: (value: number) => {
      parameterId = value;
      for (const report of reports) {
        const stockItem = report.reportParameters?.find(
          (parameter: any) => parameter.reportParameterName === "stockItemId"
        );
        if (stockItem) stockItem.parameterId = value;
      }
    },
  };
}

test("preview lists every ARDA artifact without performing writes", async () => {
  const harness = createHarness();
  const result = await setupArdaStockReports({
    ...harness.options,
    apply: false,
  });

  assert.equal(result.mode, "preview");
  assert.equal(result.tenantSettings.features.ardaStockReports, true);
  assert.equal(result.tenantSettings.theme, "forest");
  assert.equal(result.dataTable, "arda_stock_details");
  assert.equal(result.selectorReport, ARDA_STOCK_ITEM_OPTIONS_REPORT);
  assert.deepEqual(result.reports, [...ARDA_STOCK_REPORT_NAMES]);
  assert.deepEqual(result.roleIds, [7, 8]);
  assert.equal(harness.tenantWrites.length, 0);
  assert.equal(harness.catalogWrites(), 0);
  assert.equal(harness.apiCalls.length, 0);
});

test("apply rejects any target that is not isolated to the ARDA database and roles", async () => {
  const harness = createHarness();

  await assert.rejects(
    setupArdaStockReports({ ...harness.options, tenantSlug: "goodfellow" }),
    /tenant must be arda/i
  );
  await assert.rejects(
    setupArdaStockReports({
      ...harness.options,
      fineractDatabaseName: "fineract_tenant_goodfellow",
    }),
    /fineract_tenant_arda/i
  );
  await assert.rejects(
    setupArdaStockReports({
      ...harness.options,
      fineractTenantId: "goodfellow",
    }),
    /fineract tenant must be arda/i
  );
  await assert.rejects(
    setupArdaStockReports({ ...harness.options, roleIds: [] }),
    /role/i
  );
  assert.equal(harness.tenantWrites.length, 0);
  assert.equal(harness.apiCalls.length, 0);
});

test("apply creates missing artifacts, preserves settings and permissions, and verifies them", async () => {
  const harness = createHarness();
  const result = await setupArdaStockReports(harness.options);

  assert.equal(result.mode, "applied");
  assert.deepEqual(harness.tenantReads, ["arda", "arda"]);
  assert.equal(harness.tenantWrites.length, 1);
  assert.equal(harness.tenantWrites[0].id, "tenant-arda");
  assert.deepEqual(harness.tenantWrites[0].settings, {
    theme: "forest",
    integrations: { sms: true },
    features: {
      reports: true,
      notifications: true,
      ardaStockReports: true,
    },
  });
  assert.equal(harness.catalogWrites(), 1);
  assert.equal(result.parameterId, 9401);
  assert.equal(
    harness.apiCalls.filter(
      (call) => call.endpoint === "/reports" && call.method === "POST"
    ).length,
    4
  );
  assert.ok(harness.rolePermissions.get(7)?.has("READ_LOAN"));
  assert.ok(harness.rolePermissions.get(8)?.has("CREATE_CLIENT"));
  for (const roleId of [7, 8]) {
    assert.equal(harness.rolePermissions.get(roleId)?.size, 4);
  }
  assert.equal(
    harness.apiCalls.filter((call) =>
      call.endpoint.startsWith("/runreports/FullParameterList")
    ).length,
    4
  );
});

test("apply updates matching report names without duplicates and reuses the catalog parameter", async () => {
  const allReportNames = [ARDA_STOCK_ITEM_OPTIONS_REPORT, ...ARDA_STOCK_REPORT_NAMES];
  const harness = createHarness(allReportNames);
  harness.setParameterId(7711);
  const result = await setupArdaStockReports(harness.options);

  assert.equal(result.parameterId, 7711);
  assert.equal(
    harness.apiCalls.filter(
      (call) => call.endpoint === "/reports" && call.method === "POST"
    ).length,
    0
  );
  assert.equal(
    harness.apiCalls.filter(
      (call) => /^\/reports\/\d+$/.test(call.endpoint) && call.method === "PUT"
    ).length,
    4
  );
  const visibleUpdates = harness.apiCalls.filter(
    (call) =>
      /^\/reports\/\d+$/.test(call.endpoint) &&
      call.method === "PUT" &&
      call.body.reportName !== ARDA_STOCK_ITEM_OPTIONS_REPORT
  );
  assert.ok(
    visibleUpdates.every((call) =>
      call.body.reportParameters.every((parameter: any) =>
        Number.isInteger(parameter.id)
      )
    )
  );
  assert.equal(harness.catalogWrites(), 1);
});
