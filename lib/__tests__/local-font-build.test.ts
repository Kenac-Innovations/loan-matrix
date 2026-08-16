import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");

assert.match(layout, /from "next\/font\/local"/);
assert.doesNotMatch(layout, /from "next\/font\/google"/);
assert.match(layout, /\.\/fonts\/InterVariable\.woff2/);
assert.equal(
  existsSync(resolve(process.cwd(), "app/fonts/InterVariable.woff2")),
  true
);

console.log("ok");
