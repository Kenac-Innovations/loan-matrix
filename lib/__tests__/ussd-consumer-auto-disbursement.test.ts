import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// USSD loan application ingestion (dedup + insert) moved to loan-matrix-be —
// see zw.co.kenac.loanmatrixbe.ussdloans.service.UssdLoanApplicationListener
// and its UssdLoanApplicationListenerTests. This module only still owns the
// auto-lead-creation / CDE-decisioning / auto-disbursement pipeline that
// runs once a row already exists.
const source = readFileSync(
  path.join(process.cwd(), "lib/ussd-auto-processing-poller.ts"),
  "utf8"
);

test("poller sends configured USSD products through shared processing", () => {
  assert.match(source, /findMatchingUssdAutoLeadRule/);
  assert.match(source, /processUssdApplicationToDisbursement/);
  assert.match(source, /runWithBoundedRetries/);
});

test("poller persists automatic-processing outcome and failure notes", () => {
  assert.match(source, /AUTO_DISBURSED/);
  assert.match(source, /MANUAL_REVIEW/);
  assert.match(source, /AUTO_PROCESSING_STOPPED/);
  assert.match(source, /AUTO_PROCESSING_FAILED/);
  assert.match(source, /processingNotes/);
});
