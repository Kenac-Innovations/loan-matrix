import assert from "node:assert/strict";
import test from "node:test";

import {
  holidayCreateInputSchema,
  holidayUpdateInputSchema,
  officeInputSchema,
  officeUpdateInputSchema,
  toFineractHolidayCreatePayload,
  toFineractOfficePayload,
  toFineractOfficeUpdatePayload,
} from "../organization-form-schemas";

test("office input validates a parent and converts dates for Fineract", () => {
  const parsed = officeInputSchema.parse({
    name: "  Lusaka Branch  ",
    parentId: "1",
    openingDate: "2026-09-23",
    externalId: " LSK-01 ",
  });

  assert.deepEqual(toFineractOfficePayload(parsed), {
    name: "Lusaka Branch",
    parentId: 1,
    openingDate: "23 September 2026",
    externalId: "LSK-01",
    dateFormat: "dd MMMM yyyy",
    locale: "en",
  });
});

test("office input rejects an invalid calendar date and missing parent", () => {
  const result = officeInputSchema.safeParse({
    name: "Branch",
    parentId: "",
    openingDate: "2026-02-30",
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.path[0] === "parentId"));
    assert.ok(result.error.issues.some((issue) => issue.path[0] === "openingDate"));
  }
});

test("head office updates omit the parent while retaining an explicit cleared external ID", () => {
  const parsed = officeUpdateInputSchema.parse({
    name: "Head Office",
    openingDate: "2026-09-23",
    externalId: "",
  });

  assert.deepEqual(toFineractOfficeUpdatePayload(parsed), {
    name: "Head Office",
    openingDate: "23 September 2026",
    externalId: "",
    dateFormat: "dd MMMM yyyy",
    locale: "en",
  });
});

test("holiday input requires offices and a rescheduling date for type 2", () => {
  const result = holidayCreateInputSchema.safeParse({
    name: "Founders Day",
    fromDate: "2026-09-23",
    toDate: "2026-09-23",
    reschedulingType: 2,
    repaymentsRescheduledTo: "",
    officeIds: [],
  });

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => issue.path[0] === "officeIds"));
    assert.ok(
      result.error.issues.some(
        (issue) => issue.path[0] === "repaymentsRescheduledTo",
      ),
    );
  }
});

test("holiday input creates a Fineract-safe payload", () => {
  const parsed = holidayCreateInputSchema.parse({
    name: "Founders Day",
    description: "Annual closure",
    fromDate: "2026-09-23",
    toDate: "2026-09-24",
    reschedulingType: 2,
    repaymentsRescheduledTo: "2026-09-25",
    officeIds: [1, 3],
  });

  assert.deepEqual(toFineractHolidayCreatePayload(parsed), {
    name: "Founders Day",
    description: "Annual closure",
    fromDate: "23 September 2026",
    toDate: "24 September 2026",
    reschedulingType: 2,
    repaymentsRescheduledTo: "25 September 2026",
    offices: [{ officeId: 1 }, { officeId: 3 }],
    dateFormat: "dd MMMM yyyy",
    locale: "en",
  });
});

test("active holiday updates can change only editable metadata", () => {
  const parsed = holidayUpdateInputSchema.parse({
    name: "Founders Day",
    description: "Updated description",
  });

  assert.equal(parsed.name, "Founders Day");
  assert.equal(parsed.description, "Updated description");
});
