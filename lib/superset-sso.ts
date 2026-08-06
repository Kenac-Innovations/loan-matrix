import { randomUUID } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";
import type { SupersetRole } from "./superset-config";

const ASSERTION_LIFETIME_SECONDS = 60;
const DEFAULT_ISSUER = "loan-matrix";
const DEFAULT_AUDIENCE = "loan-matrix-superset";

export interface SupersetAssertionInput {
  subject: string;
  username: string;
  name?: string | null;
  email?: string | null;
  tenantSlug: string;
  role: SupersetRole;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function createSupersetAssertion(
  input: SupersetAssertionInput,
  privateKeyPem: string,
  now = new Date()
): Promise<string> {
  const privateKey = await importPKCS8(privateKeyPem, "RS256");
  const issuedAt = Math.floor(now.getTime() / 1_000);

  return new SignJWT({
    username: input.username,
    name: input.name || input.username,
    email: input.email || undefined,
    tenantSlug: input.tenantSlug,
    role: input.role,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(process.env.SUPERSET_SSO_ISSUER || DEFAULT_ISSUER)
    .setAudience(process.env.SUPERSET_SSO_AUDIENCE || DEFAULT_AUDIENCE)
    .setSubject(input.subject)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ASSERTION_LIFETIME_SECONDS)
    .sign(privateKey);
}

export function renderSupersetLaunchForm(
  baseUrl: string,
  assertion: string
): string {
  const action = `${baseUrl.replace(/\/+$/, "")}/login/sso/consume`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Opening Advanced Analytics</title>
  </head>
  <body>
    <p>Opening Advanced Analytics securely...</p>
    <form id="sso-launch" action="${escapeHtml(action)}" method="post">
      <input type="hidden" name="assertion" value="${escapeHtml(assertion)}">
      <noscript><button type="submit">Continue to Advanced Analytics</button></noscript>
    </form>
    <script>document.getElementById("sso-launch").submit()</script>
  </body>
</html>`;
}
