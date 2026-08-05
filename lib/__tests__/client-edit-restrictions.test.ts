import assert from "node:assert/strict";
import test from "node:test";

import {
  RESTRICTED_CLIENT_EDIT_FIELDS,
  isSensitiveClientEditRestrictionEnabled,
  stripRestrictedClientEditFields,
} from "../client-edit-restrictions";

test("sensitive client edit restriction defaults to false", () => {
  assert.equal(isSensitiveClientEditRestrictionEnabled(null), false);
});

test("sensitive client edit restriction reads the tenant feature flag", () => {
  assert.equal(
    isSensitiveClientEditRestrictionEnabled({
      features: { restrictSensitiveClientEditFieldsToSuperAdmin: true },
    }),
    true
  );
});

test("stripRestrictedClientEditFields removes the sensitive client edit fields only", () => {
  const payload = {
    firstname: "ELIAH",
    lastname: "NYIRENDA",
    isStaff: true,
    staffId: 77,
    mobileNo: "+260967898505",
    submittedOnDate: "2025-12-17",
    activationDate: "2025-12-18",
    emailAddress: "eliah@goodfellow.co.zm",
  };

  const sanitized = stripRestrictedClientEditFields(payload) as Record<
    string,
    unknown
  >;

  for (const field of RESTRICTED_CLIENT_EDIT_FIELDS) {
    assert.equal(field in sanitized, false, `expected ${field} to be removed`);
  }

  assert.equal(sanitized.firstname, payload.firstname);
  assert.equal(sanitized.lastname, payload.lastname);
  assert.equal(sanitized.emailAddress, payload.emailAddress);
});
