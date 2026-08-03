import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { filterRecoveryRowsByClientName } from "../recovery-client-name-search";

const rows = [
  { loanId: 101, clientName: "Francis Mutambo" },
  { loanId: 102, clientName: "Jessy Thole" },
  { loanId: 103, clientName: "Francisca Mumba" },
];

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("filters recovery rows by a partial client name without regard to case", () => {
  assert.deepEqual(
    filterRecoveryRowsByClientName(rows, "FRANCIS").map((row) => row.loanId),
    [101, 103]
  );
});

test("keeps all recovery rows when the client-name search is blank", () => {
  assert.deepEqual(
    filterRecoveryRowsByClientName(rows, "  ").map((row) => row.loanId),
    [101, 102, 103]
  );
});

test("recovery queue sends client-name searches to the paginated arrears API", () => {
  const dashboardSource = readRepoFile(
    "app/(application)/loans/recoveries/recoveries-dashboard.tsx"
  );
  const routeSource = readRepoFile("app/api/recoveries/arrears/route.ts");

  assert.match(dashboardSource, /placeholder="Search by client name"/);
  assert.match(dashboardSource, /params\.set\("clientName", clientNameSearch\)/);
  assert.match(routeSource, /searchParams\.get\("clientName"\)/);
  assert.match(routeSource, /clientName/);
});
