import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

test("statement PDF download ships html2pdf with development and production builds", () => {
  const packageJson = readFileSync(path.join(repoRoot, "package.json"), "utf8");
  const buildScript = readFileSync(
    path.join(repoRoot, "scripts/copy-html2pdf-bundle.mjs"),
    "utf8"
  );

  assert.match(packageJson, /"html2pdf\.js": "0\.10\.3"/);
  assert.match(packageJson, /"predev": "pnpm run prepare:html2pdf"/);
  assert.match(packageJson, /"build": "prisma generate && pnpm run prepare:html2pdf && next build --webpack"/);
  assert.match(buildScript, /html2pdf\.js\/dist\/html2pdf\.bundle\.min\.js/);
  assert.match(buildScript, /public\/html2pdf\.bundle\.min\.js/);
});

test("statement PDF download reports a missing generator instead of becoming a no-op", () => {
  const template = readFileSync(
    path.join(repoRoot, "lib/loan-statement-template.ts"),
    "utf8"
  );

  assert.match(template, /<script src="\/html2pdf\.bundle\.min\.js"><\/script>/);
  assert.match(template, /if \(typeof window\.html2pdf !== 'function'\)/);
  assert.match(
    template,
    /PDF generation is unavailable\. Use Print and select "Save to PDF"\./
  );
});
