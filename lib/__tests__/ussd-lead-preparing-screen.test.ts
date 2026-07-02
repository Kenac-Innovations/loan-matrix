import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("ussd lead preparing screen exists and shows progress feedback", () => {
  const source = readRepoFile("app/(application)/leads/[id]/preparing/page.tsx");

  assert.match(source, /Preparing lead/i);
  assert.match(source, /progress/i);
  assert.match(source, /useSearchParams/);
  assert.match(source, /\/api\/ussd-leads\/\$\{applicationId\}\/submit/);
  assert.match(source, /router\.replace\(`\/leads\/\$\{leadId\}`\)/);
});

test("ussd view details routes through the preparing screen", () => {
  const source = readRepoFile("components/tables/UssdLoanApplicationsTable.tsx");

  assert.match(
    source,
    /window\.location\.href = `\/leads\/\$\{leadId\}\/preparing\?applicationId=\$\{app\.loanApplicationUssdId\}`;/
  );
});
