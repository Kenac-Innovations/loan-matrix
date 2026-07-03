import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("ussd workspace defaults to today and propagates date filters through applications and leads feeds", () => {
  const pageSource = readRepoFile("app/(application)/ussd-leads/page.tsx");
  const ussdActionsSource = readRepoFile("app/actions/ussd-leads-actions.ts");
  const ussdApiRouteSource = readRepoFile("app/api/ussd-leads/route.ts");
  const paginatedLeadsRouteSource = readRepoFile(
    "app/api/leads/paginated/route.ts"
  );
  const workspaceTabsSource = readRepoFile(
    "app/(application)/ussd-leads/components/ussd-workspace-tabs.tsx"
  );
  const leadsPanelSource = readRepoFile(
    "app/(application)/ussd-leads/components/ussd-linked-leads-panel.tsx"
  );
  const applicationsTableSource = readRepoFile(
    "components/tables/UssdLoanApplicationsTable.tsx"
  );

  assert.match(pageSource, /searchParams/);
  assert.match(pageSource, /startDate/);
  assert.match(pageSource, /endDate/);
  assert.match(pageSource, /UssdDateRangeFilter/);

  assert.match(workspaceTabsSource, /startDate/);
  assert.match(workspaceTabsSource, /endDate/);

  assert.match(ussdActionsSource, /startDate\?: string/);
  assert.match(ussdActionsSource, /endDate\?: string/);
  assert.match(ussdActionsSource, /createdAt:/);

  assert.match(ussdApiRouteSource, /searchParams\.get\("startDate"\)/);
  assert.match(ussdApiRouteSource, /searchParams\.get\("endDate"\)/);

  assert.match(paginatedLeadsRouteSource, /searchParams\.get\("startDate"\)/);
  assert.match(paginatedLeadsRouteSource, /searchParams\.get\("endDate"\)/);

  assert.match(leadsPanelSource, /startDate/);
  assert.match(leadsPanelSource, /endDate/);
  assert.match(applicationsTableSource, /startDate/);
  assert.match(applicationsTableSource, /endDate/);
});
