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
      baseUrl: "https://analytics.kenacloanmatrix.com/",
      creatorUsernames: [" MIFOS ", "mifos", "", " Analyst "],
    },
  }),
  {
    enabled: true,
    baseUrl: "https://analytics.kenacloanmatrix.com",
    creatorUsernames: ["mifos", "analyst"],
  }
);

assert.deepEqual(
  getTenantSupersetConfig({
    superset: {
      enabled: true,
      baseUrl: "http://analytics.kenacloanmatrix.com",
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
assert.equal(resolveSupersetRole(" analyst ", ["mifos", "analyst"]), "creator");
assert.equal(resolveSupersetRole("other-user", ["mifos"]), "viewer");
assert.equal(resolveSupersetRole(undefined, ["mifos"]), "viewer");
assert.equal(
  isTenantSupersetRequestedEnabled({ superset: { enabled: true } }),
  true
);
assert.equal(isTenantSupersetRequestedEnabled({}), false);

console.log("ok");
