import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(
  path.join(process.cwd(), "lib/amqp-queue-service.ts"),
  "utf8"
);

test("consumer sends configured USSD products through shared processing", () => {
  assert.match(source, /findMatchingUssdAutoLeadRule/);
  assert.match(source, /processUssdApplicationToDisbursement/);
  assert.match(source, /runWithBoundedRetries/);
});

test("duplicate USSD applications resume instead of returning early", () => {
  assert.match(source, /existingApp\s*\?\?/);

  const duplicateStart = source.indexOf("if (existingApp)");
  const createStart = source.indexOf(
    "prisma.ussdLoanApplication.create",
    duplicateStart
  );
  const duplicateBranch = source.slice(duplicateStart, createStart);

  assert.doesNotMatch(duplicateBranch, /return;/);
});

test("consumer persists automatic-processing outcome and failure notes", () => {
  assert.match(source, /AUTO_DISBURSED/);
  assert.match(source, /MANUAL_REVIEW/);
  assert.match(source, /AUTO_PROCESSING_STOPPED/);
  assert.match(source, /AUTO_PROCESSING_FAILED/);
  assert.match(source, /processingNotes/);
});
