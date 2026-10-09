import assert from "node:assert/strict";
import test from "node:test";

import {
  ARDA_STOCK_ITEM_OPTIONS_REPORT,
  ARDA_STOCK_REPORT_NAMES,
  buildArdaStockReportDefinitions,
} from "../fineract-arda-stock-reports";

const STOCK_ITEM_PARAMETER_ID = 7401;

function definition(name: string) {
  const found = buildArdaStockReportDefinitions(STOCK_ITEM_PARAMETER_ID).find(
    (report) => report.reportName === name
  );
  assert.ok(found, `missing ${name}`);
  return found;
}

test("defines one hidden selector and the three exact ARDA reports", () => {
  const reports = buildArdaStockReportDefinitions(STOCK_ITEM_PARAMETER_ID);

  assert.equal(reports.length, 4);
  assert.deepEqual(ARDA_STOCK_REPORT_NAMES, [
    "ARDA Stock Disbursement Report",
    "ARDA Stock Repayment Report",
    "ARDA Stock Item Performance",
  ]);
  assert.equal(reports[0].reportName, ARDA_STOCK_ITEM_OPTIONS_REPORT);
  assert.equal(reports[0].useReport, false);
  assert.deepEqual(
    reports.slice(1).map((report) => report.reportName),
    ARDA_STOCK_REPORT_NAMES
  );
  assert.ok(reports.slice(1).every((report) => report.useReport));
});

test("uses standard Fineract parameters plus the supplied stock item parameter", () => {
  const reports = buildArdaStockReportDefinitions(STOCK_ITEM_PARAMETER_ID);
  const expected = [1, 2, 5, 10, 25, STOCK_ITEM_PARAMETER_ID];

  for (const report of reports.slice(1)) {
    assert.deepEqual(
      report.reportParameters?.map((parameter) => parameter.parameterId),
      expected
    );
  }
});

test("all report SQL respects current-user and selected-office hierarchy", () => {
  for (const report of buildArdaStockReportDefinitions(STOCK_ITEM_PARAMETER_ID)) {
    assert.match(report.reportSql, /\$\{currentUserHierarchy\}/);
    if (report.useReport) {
      assert.match(report.reportSql, /\$\{officeId\}/);
      assert.match(report.reportSql, /m_office[\s\S]*hierarchy/i);
    }
  }
});

test("disbursement report is inclusive, filterable, unreversed, and stock-valued", () => {
  const sql = definition("ARDA Stock Disbursement Report").reportSql;

  assert.match(sql, /transaction_type_enum\s*=\s*1/);
  assert.match(sql, /is_reversed\s*=\s*false/);
  assert.match(sql, /transaction_date::date\s+BETWEEN[\s\S]*\$\{startDate\}[\s\S]*\$\{endDate\}/i);
  assert.match(sql, /\$\{currencyId\}/);
  assert.match(sql, /\$\{loanProductId\}/);
  assert.match(sql, /\$\{stockItemId\}/);
  assert.match(sql, /arda_stock_details[\s\S]*loan_id/i);
  assert.match(sql, /COALESCE\(asd\.total_stock_value,\s*lt\.amount\)/i);
  assert.match(sql, /principal_repaid_derived/i);
  assert.match(sql, /total_outstanding_derived/i);
  assert.match(sql, /Not captured/);
});

test("repayment report exposes payment, cashier, allocation, and balance columns", () => {
  const sql = definition("ARDA Stock Repayment Report").reportSql;

  assert.match(sql, /transaction_type_enum\s*=\s*2/);
  assert.match(sql, /is_reversed\s*=\s*false/);
  assert.match(sql, /m_payment_type/i);
  assert.match(sql, /m_appuser/i);
  assert.match(sql, /principal_portion_derived/i);
  assert.match(sql, /interest_portion_derived/i);
  assert.match(sql, /fee_charges_portion_derived/i);
  assert.match(sql, /penalty_charges_portion_derived/i);
  assert.match(sql, /outstanding_loan_balance_derived/i);
  assert.match(sql, /Not captured/);
});

test("performance report aggregates monthly sales and ranks captured stock only", () => {
  const sql = definition("ARDA Stock Item Performance").reportSql;

  assert.match(sql, /date_trunc\('month',\s*lt\.transaction_date\)/i);
  assert.match(sql, /COUNT\(DISTINCT\s+lt\.id\)/i);
  assert.match(sql, /SUM\([^)]*quantity/i);
  assert.match(sql, /SUM\([^)]*total_stock_value/i);
  assert.match(sql, /AVG\([^)]*quantity/i);
  assert.match(sql, /AVG\([^)]*unit_value/i);
  assert.match(sql, /DENSE_RANK\(\)\s+OVER/i);
  assert.match(sql, /CASE[\s\S]*stock_item_id\s+IS\s+NULL[\s\S]*DENSE_RANK/i);
  assert.match(sql, /Not captured/);
});
