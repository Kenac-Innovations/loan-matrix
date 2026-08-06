import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "app/(application)/reports/page.tsx"),
  "utf8"
);

assert.match(source, /Advanced Analytics/);
assert.match(source, /fetch\("\/api\/tenant\/analytics"/);
assert.match(source, /action="\/api\/analytics\/launch"/);
assert.match(source, /method="post"/);
assert.match(source, /target="_blank"/);
assert.match(source, /analyticsEnabled\s*&&/);

console.log("ok");
