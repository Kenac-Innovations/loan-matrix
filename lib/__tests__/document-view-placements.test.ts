import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("document screens use the shared document view button", () => {
  const files = [
    "app/(application)/clients/[id]/components/client-documents.tsx",
    "app/(application)/clients/[id]/components/client-entity-kyc.tsx",
    "app/(application)/clients/[id]/loans/[loanId]/components/client-loan-details.tsx",
    "app/(application)/leads/[id]/components/lead-documents.tsx",
    "app/(application)/leads/[id]/components/comprehensive-lead-details.tsx",
    "app/(application)/leads/new/components/client-registration-form.tsx",
    "app/(application)/leads/new/components/invoice-discounting-form.tsx",
  ];

  for (const file of files) {
    assert.match(readRepoFile(file), /DocumentViewButton/, file);
  }
});
