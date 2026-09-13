import assert from "node:assert/strict";
import test from "node:test";

import {
  createLeadTenantContext,
  LeadTenantContextError,
} from "./lead-tenant-context";

test("rejects a request whose hostname tenant differs from the signed-in tenant", () => {
  assert.throws(
    () =>
      createLeadTenantContext({
        sessionTenantId: "goodfellow-id",
        requestTenant: { id: "default-id", slug: "default" },
        sessionTenant: { id: "goodfellow-id", slug: "goodfellow" },
      }),
    (error: unknown) => error instanceof LeadTenantContextError,
  );
});

test("keeps concurrent lead requests isolated to their own tenant context", async () => {
  let releaseGoodfellow!: () => void;
  const goodfellowBlocked = new Promise<void>((resolve) => {
    releaseGoodfellow = resolve;
  });

  const goodfellowRequest = (async () => {
    const context = createLeadTenantContext({
      sessionTenantId: "goodfellow-id",
      requestTenant: { id: "goodfellow-id", slug: "goodfellow" },
      sessionTenant: { id: "goodfellow-id", slug: "goodfellow" },
    });
    await goodfellowBlocked;
    return context;
  })();

  const defaultRequest = createLeadTenantContext({
    sessionTenantId: "default-id",
    requestTenant: { id: "default-id", slug: "default" },
    sessionTenant: { id: "default-id", slug: "default" },
  });

  releaseGoodfellow();
  const goodfellowContext = await goodfellowRequest;

  assert.deepEqual(goodfellowContext, {
    tenantId: "goodfellow-id",
    tenantSlug: "goodfellow",
    fineractTenantId: "goodfellow",
  });
  assert.deepEqual(defaultRequest, {
    tenantId: "default-id",
    tenantSlug: "default",
    fineractTenantId: "default",
  });
});
