import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("ussd workspace uses applications and pipeline-style leads tabs", () => {
  const pageSource = readRepoFile("app/(application)/ussd-leads/page.tsx");
  const pipelineSource = readRepoFile("app/(application)/leads/components/pipeline-view.tsx");
  const apiSource = readRepoFile("app/api/leads/paginated/route.ts");
  const leadsActionsSource = readRepoFile("app/actions/leads-actions.ts");
  const ussdActionsSource = readRepoFile("app/actions/ussd-leads-actions.ts");
  const applicationsTableSource = readRepoFile("components/tables/UssdLoanApplicationsTable.tsx");

  assert.match(pageSource, /USSD Applications/);
  assert.match(pageSource, /USSD Leads/);
  assert.match(pageSource, /PipelineView/);
  assert.match(pageSource, /source="USSD"/);
  assert.match(pageSource, /Promise\.allSettled/);
  assert.match(pageSource, /emptyPipelineData/);
  assert.match(pipelineSource, /source\?: string;/);
  assert.match(pipelineSource, /params\.append\("source", source\)/);
  assert.match(apiSource, /const source = searchParams\.get\("source"\) \|\| undefined;/);
  assert.match(leadsActionsSource, /stateMetadata = \{\s*path: \["source"\],\s*equals: source/);
  assert.match(ussdActionsSource, /buildUssdLinkedLeadLookup/);
  assert.match(applicationsTableSource, /\.filter\(\(app: UssdLoanApplication\) => !app\.leadId\)/);
});

test("legacy ussd leads route redirects to the new workspace", () => {
  const legacyRoute = readRepoFile("app/(application)/leads/ussd/page.tsx");

  assert.match(legacyRoute, /redirect\("\/ussd-leads"\)/);
});
