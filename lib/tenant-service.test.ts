import assert from "node:assert/strict";
import test from "node:test";

import { extractTenantSlug, UnresolvedTenantError } from "./tenant-service";

test("extractTenantSlug resolves a plain subdomain to its own slug", () => {
  assert.equal(extractTenantSlug("gemini.kenac.tech"), "gemini");
  assert.equal(extractTenantSlug("rulethu.kenac.tech"), "rulethu");
});

test("extractTenantSlug keeps arda's dedicated hostname mapping", () => {
  assert.equal(extractTenantSlug("ardaloanmatrix.kenac.tech"), "arda");
});

test("extractTenantSlug falls back to goodfellow only for hostless/local dev cases", () => {
  assert.equal(extractTenantSlug(""), "goodfellow");
  assert.equal(extractTenantSlug("localhost:3000"), "goodfellow");
});

test("UnresolvedTenantError names the slug that couldn't be resolved and does not suggest a substitute tenant", () => {
  const err = new UnresolvedTenantError("gemini");
  assert.equal(err.requestedSlug, "gemini");
  assert.match(err.message, /gemini/);
  assert.doesNotMatch(err.message, /goodfellow/i);
});
