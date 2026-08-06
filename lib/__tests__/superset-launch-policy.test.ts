import assert from "node:assert/strict";
import { evaluateSupersetLaunchPolicy } from "../superset-launch-policy";

const validConfig = {
  enabled: true,
  baseUrl: "https://goodfellow.kenac.tech/analytics",
  creatorUsernames: ["mifos"],
};

assert.deepEqual(
  evaluateSupersetLaunchPolicy({
    sessionUser: null,
    sessionTenantId: null,
    tenantId: "tenant-goodfellow",
    tenantSlug: "goodfellow",
    reportsEnabled: true,
    supersetRequestedEnabled: true,
    config: validConfig,
  }),
  { allowed: false, status: 401, reason: "unauthenticated" }
);

assert.deepEqual(
  evaluateSupersetLaunchPolicy({
    sessionUser: { username: "mifos", userId: 84 },
    sessionTenantId: "tenant-omama",
    tenantId: "tenant-omama",
    tenantSlug: "omama",
    reportsEnabled: true,
    supersetRequestedEnabled: true,
    config: validConfig,
  }),
  { allowed: false, status: 404, reason: "superset_disabled" }
);

assert.deepEqual(
  evaluateSupersetLaunchPolicy({
    sessionUser: { username: "mifos", userId: 84 },
    sessionTenantId: "another-tenant",
    tenantId: "tenant-goodfellow",
    tenantSlug: "goodfellow",
    reportsEnabled: true,
    supersetRequestedEnabled: true,
    config: validConfig,
  }),
  { allowed: false, status: 403, reason: "tenant_mismatch" }
);

assert.equal(
  evaluateSupersetLaunchPolicy({
    sessionUser: { username: "analyst", userId: 10 },
    sessionTenantId: "tenant-goodfellow",
    tenantId: "tenant-goodfellow",
    tenantSlug: "goodfellow",
    reportsEnabled: false,
    supersetRequestedEnabled: true,
    config: validConfig,
  }).status,
  403
);

assert.equal(
  evaluateSupersetLaunchPolicy({
    sessionUser: { username: "analyst", userId: 10 },
    sessionTenantId: "tenant-goodfellow",
    tenantId: "tenant-goodfellow",
    tenantSlug: "goodfellow",
    reportsEnabled: true,
    supersetRequestedEnabled: false,
    config: { enabled: false, baseUrl: null, creatorUsernames: [] },
  }).status,
  404
);

assert.equal(
  evaluateSupersetLaunchPolicy({
    sessionUser: { username: "analyst", userId: 10 },
    sessionTenantId: "tenant-goodfellow",
    tenantId: "tenant-goodfellow",
    tenantSlug: "goodfellow",
    reportsEnabled: true,
    supersetRequestedEnabled: true,
    config: { enabled: false, baseUrl: null, creatorUsernames: ["mifos"] },
  }).status,
  503
);

const viewerDecision = evaluateSupersetLaunchPolicy({
  sessionUser: { username: "analyst", userId: 10 },
  sessionTenantId: "tenant-goodfellow",
  tenantId: "tenant-goodfellow",
  tenantSlug: "goodfellow",
  reportsEnabled: true,
  supersetRequestedEnabled: true,
  config: validConfig,
});
assert.equal(viewerDecision.allowed, true);
assert.equal(viewerDecision.allowed && viewerDecision.role, "viewer");

const creatorDecision = evaluateSupersetLaunchPolicy({
  sessionUser: { username: "MIFOS", userId: 84 },
  sessionTenantId: "tenant-goodfellow",
  tenantId: "tenant-goodfellow",
  tenantSlug: "goodfellow",
  reportsEnabled: true,
  supersetRequestedEnabled: true,
  config: validConfig,
});
assert.equal(creatorDecision.allowed, true);
assert.equal(creatorDecision.allowed && creatorDecision.role, "creator");

console.log("ok");
