import assert from "node:assert/strict";
import test from "node:test";
import {
  ArdaSourceAuditOptionsError,
  parseArdaSourceAuditOptions,
} from "../arda-source-audit-options";

test("parses a read-only Omama source audit command", () => {
  assert.deepEqual(
    parseArdaSourceAuditOptions([
      "--source-loan-matrix-url=postgresql://source.example/loan_matrix",
      "--source-fineract-base-url=https://fineract.example",
      "--out=/tmp/arda-source-manifest.json",
    ]),
    {
      sourceLoanMatrixUrl: "postgresql://source.example/loan_matrix",
      sourceFineractBaseUrl: "https://fineract.example",
      sourceFineractTenant: "omama",
      out: "/tmp/arda-source-manifest.json",
    },
  );
});

test("rejects ARDA as an audit source tenant", () => {
  assert.throws(
    () =>
      parseArdaSourceAuditOptions([
        "--source-loan-matrix-url=postgresql://source.example/loan_matrix",
        "--source-fineract-base-url=https://fineract.example",
        "--source-fineract-tenant=arda",
        "--out=/tmp/arda-source-manifest.json",
      ]),
    ArdaSourceAuditOptionsError,
  );
});

test("requires an explicit local output path", () => {
  assert.throws(
    () =>
      parseArdaSourceAuditOptions([
        "--source-loan-matrix-url=postgresql://source.example/loan_matrix",
        "--source-fineract-base-url=https://fineract.example",
      ]),
    ArdaSourceAuditOptionsError,
  );
});
