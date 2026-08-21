import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("lead detail read-only Fineract requests use the service account", () => {
  const source = readRepoFile("app/(application)/leads/[id]/page.tsx");

  assert.match(source, /getFineractServiceWithServiceAuth/);
  assert.match(source, /authMode:\s*"service"/);
  assert.doesNotMatch(source, /getFineractServiceWithSession/);
});

test("the application redirects an expired browser session to sign in", () => {
  const source = readRepoFile("app/components/session-expiry-redirect.tsx");
  const providers = readRepoFile("app/providers.tsx");

  assert.match(source, /useSession/);
  assert.match(source, /"unauthenticated"/);
  assert.match(source, /router\.replace/);
  assert.match(source, /callbackUrl/);
  assert.match(providers, /SessionExpiryRedirect/);
});
