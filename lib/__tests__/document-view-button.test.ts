import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("document view button opens previewable files in a new tab and falls back to download", () => {
  const source = readRepoFile("components/document/document-view-button.tsx");

  assert.match(source, /isBrowserPreviewableDocument/);
  assert.match(source, /buildInlineDocumentPreviewUrl/);
  assert.match(source, /window\.open\(previewUrl,\s*"_blank"/);
  assert.match(source, /onFallbackDownload\?\.\(\)/);
});
