import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("ussd workspace uses separate applications and table-style leads tabs", () => {
  const pageSource = readRepoFile("app/(application)/ussd-leads/page.tsx");
  const ussdActionsSource = readRepoFile("app/actions/ussd-leads-actions.ts");
  const applicationsTableSource = readRepoFile("components/tables/UssdLoanApplicationsTable.tsx");
  const ussdLeadsTableSource = readRepoFile(
    "app/(application)/ussd-leads/components/ussd-linked-leads-table.tsx"
  );
  const workspaceTabsSource = readRepoFile(
    "app/(application)/ussd-leads/components/ussd-workspace-tabs.tsx"
  );
  const leadsPanelSource = readRepoFile(
    "app/(application)/ussd-leads/components/ussd-linked-leads-panel.tsx"
  );

  assert.match(pageSource, /USSD Leads/);
  assert.match(pageSource, /UssdWorkspaceTabs/);
  assert.doesNotMatch(pageSource, /getLeadsData/);
  assert.doesNotMatch(pageSource, /PipelineView/);
  assert.doesNotMatch(pageSource, /Promise\.allSettled/);
  assert.match(workspaceTabsSource, /USSD Applications/);
  assert.match(workspaceTabsSource, /USSD Leads/);
  assert.match(workspaceTabsSource, /inline-flex max-w-full/);
  assert.doesNotMatch(workspaceTabsSource, /TabsList className="w-full/);
  assert.doesNotMatch(workspaceTabsSource, /className="w-full data-\[state=active\]/);
  assert.match(ussdActionsSource, /buildUssdLinkedLeadLookup/);
  assert.match(applicationsTableSource, /app\.leadId \? "Open Lead" : "View Details"/);
  assert.match(ussdLeadsTableSource, /GenericDataTable/);
  assert.match(ussdLeadsTableSource, /View Lead/);
  assert.match(workspaceTabsSource, /defaultValue=\"applications\"/);
  assert.match(workspaceTabsSource, /value === \"leads\"/);
  assert.match(leadsPanelSource, /skipFineractStatus=true/);
  assert.match(leadsPanelSource, /UssdLinkedLeadsTable/);
  assert.doesNotMatch(
    applicationsTableSource,
    /\.filter\(\(app: UssdLoanApplication\) => !app\.leadId\)/
  );
});

test("legacy ussd leads route redirects to the new workspace", () => {
  const legacyRoute = readRepoFile("app/(application)/leads/ussd/page.tsx");

  assert.match(legacyRoute, /redirect\("\/ussd-leads"\)/);
});
