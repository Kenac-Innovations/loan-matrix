import assert from "node:assert/strict";
import {
  getTenantSupersetConfig,
  isTenantSupersetRequestedEnabled,
  resolveSupersetRole,
} from "../superset-config";

assert.deepEqual(getTenantSupersetConfig(undefined), {
  enabled: false,
  baseUrl: null,
  creatorUsernames: [],
});

assert.deepEqual(
  getTenantSupersetConfig({
    superset: {
      enabled: true,
      baseUrl: "https://goodfellow.kenac.tech/analytics/",
      creatorUsernames: [" MIFOS ", "mifos", "", " Analyst "],
    },
  }),
  {
    enabled: true,
    baseUrl: "https://goodfellow.kenac.tech/analytics",
    creatorUsernames: ["mifos"],
  }
);

assert.deepEqual(
  getTenantSupersetConfig({
    superset: {
      enabled: true,
      baseUrl: "https://goodfellow.kenac.tech/analytics/",
      creatorUsernames: ["mifos"],
    },
  }),
  {
    enabled: true,
    baseUrl: "https://goodfellow.kenac.tech/analytics",
    creatorUsernames: ["mifos"],
  }
);

assert.deepEqual(
  getTenantSupersetConfig({
    superset: {
      enabled: true,
      baseUrl: "https://goodfellow.kenac.tech/analytics?unsafe=true",
    },
  }),
  {
    enabled: false,
    baseUrl: null,
    creatorUsernames: [],
  }
);

assert.deepEqual(
  getTenantSupersetConfig({
    superset: {
      enabled: true,
      baseUrl: "https://analytics.kenacloanmatrix.com",
      creatorUsernames: ["mifos"],
    },
  }),
  {
    enabled: false,
    baseUrl: null,
    creatorUsernames: ["mifos"],
  }
);

assert.equal(resolveSupersetRole("Mifos", ["mifos"]), "creator");
assert.equal(resolveSupersetRole(" analyst ", ["mifos", "analyst"]), "viewer");
assert.equal(resolveSupersetRole("other-user", ["mifos"]), "viewer");
assert.equal(resolveSupersetRole(undefined, ["mifos"]), "viewer");
assert.equal(
  isTenantSupersetRequestedEnabled({ superset: { enabled: true } }),
  true
);
assert.equal(isTenantSupersetRequestedEnabled({}), false);

console.log("ok");
