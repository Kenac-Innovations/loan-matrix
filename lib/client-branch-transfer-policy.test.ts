import assert from "node:assert/strict";
import { resolveClientBranchTransferTarget } from "./client-branch-transfer-policy";

function run() {
  const target = resolveClientBranchTransferTarget({
    sessionOfficeId: 3,
    sessionOfficeName: "Mufulira",
    clientOfficeId: 2,
    requestDestinationOfficeId: 99,
  });

  assert.equal(target.destinationOfficeId, 3);
  assert.equal(target.destinationOfficeName, "Mufulira");
  assert.equal(target.isCurrentBranch, false);

  const current = resolveClientBranchTransferTarget({
    sessionOfficeId: 3,
    sessionOfficeName: "Mufulira",
    clientOfficeId: 3,
  });

  assert.equal(current.isCurrentBranch, true);

  assert.throws(
    () =>
      resolveClientBranchTransferTarget({
        sessionOfficeId: undefined,
        sessionOfficeName: undefined,
        clientOfficeId: 2,
      }),
    /logged-in user's branch is required/i
  );
}

run();
