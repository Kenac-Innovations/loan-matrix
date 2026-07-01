import assert from "node:assert/strict";
import test from "node:test";

test("builds tenant-scoped UserSignature query inputs", async () => {
  const {
    getUserSignatureCreateData,
    getUserSignatureDeleteWhere,
    getUserSignatureUniqueWhere,
  } = await import("../user-signature-scope");

  assert.deepEqual(getUserSignatureUniqueWhere("tenant-rulethu", 1), {
    tenantId_fineractUserId: {
      tenantId: "tenant-rulethu",
      fineractUserId: 1,
    },
  });

  assert.deepEqual(getUserSignatureDeleteWhere("tenant-rulethu", 1), {
    tenantId: "tenant-rulethu",
    fineractUserId: 1,
  });

  assert.deepEqual(
    getUserSignatureCreateData(
      "tenant-rulethu",
      1,
      "data:image/png;base64,aA=="
    ),
    {
      tenantId: "tenant-rulethu",
      fineractUserId: 1,
      signatureData: "data:image/png;base64,aA==",
    }
  );
});
