import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd());

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("USSD client details stores an auditable tenant-scoped update log", () => {
  const schema = readRepoFile("prisma/schema.prisma");
  const migration = readRepoFile(
    "prisma/migrations/20260827010000_add_ussd_client_details/migration.sql"
  );

  assert.match(schema, /model UssdClientInfoUpdateLog/);
  assert.match(schema, /ussdClientInfoUpdateLogs\s+UssdClientInfoUpdateLog\[\]/);
  assert.match(schema, /canUpdateUssdClientDetails\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /sourcePhoneNumber\s+String/);
  assert.match(schema, /requestedPhoneNumber\s+String/);
  assert.match(schema, /fineractClientId\s+Int\?/);
  assert.match(schema, /actorUserId\s+Int/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "UssdClientInfoUpdateLog"/);
  assert.match(migration, /canUpdateUssdClientDetails/);
});

test("ordinary client editing no longer calls USSD", () => {
  const clientUpdateRoute = readRepoFile("app/api/clients/[id]/route.ts");

  assert.doesNotMatch(clientUpdateRoute, /updateUssdClientPhone/);
  assert.doesNotMatch(clientUpdateRoute, /normalizeUssdPhoneNumber/);
  assert.match(clientUpdateRoute, /fetchFineractAPI\(`\/clients\/\$\{clientId\}`/);
});

test("USSD client details access is enforced for the menu, lookup, logs, and update", () => {
  const access = readRepoFile("lib/ussd-client-details-access.ts");
  const lookup = readRepoFile("app/api/ussd-client-details/lookup/route.ts");
  const logs = readRepoFile("app/api/ussd-client-details/logs/route.ts");
  const update = readRepoFile("app/api/ussd-client-details/update-phone/route.ts");
  const sidebar = readRepoFile("app/(application)/components/sidebar-nav.tsx");
  const mobileSidebar = readRepoFile(
    "app/(application)/components/mobile-sidebar.tsx"
  );
  const userForm = readRepoFile(
    "app/(application)/organization/users/components/user-form.tsx"
  );

  assert.match(access, /canUpdateUssdClientDetails/);
  assert.match(access, /requireUssdClientDetailsAccess/);
  assert.match(lookup, /requireUssdClientDetailsAccess/);
  assert.match(logs, /requireUssdClientDetailsAccess/);
  assert.match(update, /requireUssdClientDetailsAccess/);
  assert.match(sidebar, /USSD Details/);
  assert.match(mobileSidebar, /USSD Details/);
  assert.match(userForm, /Can update USSD client details/);
});

test("USSD phone update logs every outcome and returns success only after Fineract verification", () => {
  const update = readRepoFile("app/api/ussd-client-details/update-phone/route.ts");

  assert.match(update, /lookupUssdUserByPhone/);
  assert.match(update, /updateUssdClientPhone/);
  assert.match(update, /primaryPhoneUpdated !== true/);
  assert.match(update, /prisma\.ussdClientInfoUpdateLog\.create/);
  assert.match(update, /prisma\.ussdClientInfoUpdateLog\.update/);
  assert.match(update, /fetchFineractAPI\(`\/clients\/\$\{user\.externalId\}`/);
  assert.match(update, /Fineract did not confirm the updated client phone number/);
  assert.match(update, /status: "SUCCESS"/);
  assert.match(update, /"FINERACT_SYNC_FAILED"/);
});

test("USSD details page is log-first and presents the two country-code phone steps", () => {
  const page = readRepoFile("app/(application)/ussd-details/page.tsx");
  const component = readRepoFile(
    "app/(application)/ussd-details/components/ussd-details-client.tsx"
  );

  assert.match(page, /USSD Details/);
  assert.match(component, /USSD information updates/);
  assert.match(component, /Update info/);
  assert.match(component, /Current USSD phone number/);
  assert.match(component, /New phone number/);
  assert.match(component, /AFRICAN_COUNTRY_CODES/);
  assert.match(component, /Fineract client ID/);
  assert.match(component, /Save update/);
});
