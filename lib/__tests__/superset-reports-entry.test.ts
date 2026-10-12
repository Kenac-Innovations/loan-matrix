import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "app/(application)/reports/page.tsx"),
  "utf8"
);
const tenantAnalyticsRoute = readFileSync(
  resolve(process.cwd(), "app/api/tenant/analytics/route.ts"),
  "utf8"
);

assert.match(source, /Advanced Analytics/);
assert.match(source, /fetch\("\/api\/tenant\/analytics"/);
assert.match(source, /href=\{analyticsUrl\}/);
assert.match(source, /target="_blank"/);
assert.match(source, /rel="noopener noreferrer"/);
assert.match(source, /analyticsUrl\s*&&/);
assert.doesNotMatch(source, /action="\/api\/analytics\/launch"/);
assert.doesNotMatch(source, /<form/);
assert.match(tenantAnalyticsRoute, /url:\s*decision\.baseUrl/);

console.log("ok");
