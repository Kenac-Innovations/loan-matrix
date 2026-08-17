import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("journal search page uses a searchable GL account filter", () => {
  const source = readRepoFile("app/(application)/accounting/search-journal/page.tsx");

  assert.match(
    source,
    /SearchableSelect,\s*type Option\s*\}\s*from ['"]@\/components\/searchable-select['"]/,
    "journal search page should import the shared SearchableSelect component"
  );

  assert.match(
    source,
    /const glAccountOptions = useMemo<Option\[\]>\(/,
    "journal search page should build GL account options for the searchable select"
  );

  assert.match(
    source,
    /GL Account[\s\S]{0,500}<SearchableSelect[\s\S]{0,500}options=\{glAccountOptions\}[\s\S]{0,300}placeholder="Select GL account"/,
    "GL Account filter should render through SearchableSelect with the shared options"
  );
});
