import assert from "node:assert/strict";
import { getPermissionValidationError } from "@/lib/fineract-auth";

function main() {
  assert.equal(
    getPermissionValidationError([]),
    null,
    "users without mapped permissions should still be allowed to proceed through login"
  );

  assert.equal(
    getPermissionValidationError(["READ_USER"]),
    null,
    "users missing READ_CURRENCY and READ_REPORT should still be allowed to proceed through login"
  );

  assert.equal(
    getPermissionValidationError(["READ_CURRENCY", "READ_REPORT"]),
    null,
    "users missing READ_USER should still be allowed to proceed through login"
  );

  assert.equal(
    getPermissionValidationError(["ALL_FUNCTIONS"]),
    null,
    "super users should continue to proceed through login"
  );
}

main();
