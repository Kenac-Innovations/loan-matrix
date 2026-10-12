# Goodfellow Superset SSO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Goodfellow-only Advanced Analytics entry in Loan Matrix and deploy Apache Superset 6.1.0 with short-lived shared SSO, view-only access for Reports users, and creator access for `mifos`.

**Architecture:** Loan Matrix reads a `superset` block from the current tenant's database settings and exposes a server-side launch endpoint only when Reports and Superset are enabled. The endpoint signs a 60-second RS256 assertion and posts it to a custom Superset security extension, which prevents replay through Redis, provisions the user, reconciles a constrained role, and creates a normal Superset session. Superset runs in `superset-prod` with external PostgreSQL metadata, a lightweight Redis instance, TLS, and read-only Goodfellow reporting credentials.

**Tech Stack:** Next.js 16, TypeScript, NextAuth, `jose`, Node test runner, Apache Superset 6.1.0, Flask-AppBuilder, PyJWT, Redis, PostgreSQL, Docker, Helm 0.15.5, Kubernetes, Istio, Argo CD.

## Global Constraints

- Superset is enabled only through `Tenant.settings.superset`; do not hard-code Goodfellow hostnames in Loan Matrix UI authorization.
- Production host is `https://analytics.kenacloanmatrix.com`.
- Only users with authenticated Loan Matrix sessions and Reports access may launch Superset.
- Default Superset role is `LoanMatrixViewer`; only configured usernames, initially `mifos`, receive `LoanMatrixCreator`.
- `LoanMatrixCreator` must not receive Superset Admin, security, user/role management, database management, or SQL Lab access.
- JWT assertions use RS256, issuer `loan-matrix`, audience `loan-matrix-superset`, a unique `jti`, and a maximum lifetime of 60 seconds.
- Assertions are sent by POST and may not appear in query strings or logs.
- Superset accepts only assertions for tenant slug `goodfellow` and rejects replayed `jti` values atomically through Redis.
- Superset sessions expire after 30 minutes of inactivity.
- Deploy one web replica and no Celery worker or beat in the initial release.
- Use external PostgreSQL metadata and read-only Goodfellow data-source credentials; do not deploy the chart's PostgreSQL dependency.
- Do not commit credentials, private keys, public keys, database passwords, or Superset `SECRET_KEY`.
- Rollback must be possible by setting `Tenant.settings.superset.enabled` to `false`.

---

## File Map

### Loan Matrix repository

- `shared/types/tenant.ts`: public tenant Superset settings type.
- `lib/superset-config.ts`: strict database settings parsing, HTTPS URL validation, and creator role resolution.
- `lib/superset-sso.ts`: RS256 assertion creation and safe POST-form HTML rendering.
- `lib/__tests__/superset-config.test.ts`: settings and role-mapping tests.
- `lib/__tests__/superset-sso.test.ts`: assertion and HTML transport tests.
- `app/api/tenant/analytics/route.ts`: sanitized client configuration for the Reports page.
- `app/api/analytics/launch/route.ts`: authenticated and tenant-gated SSO launch endpoint.
- `app/(application)/reports/page.tsx`: Advanced Analytics card and POST launch action.

### GitOps repository

- `projects/loan-matrix/helm-chart/templates/deployment.yaml`: inject the existing-secret private signing key into Loan Matrix.
- `projects/loan-matrix/environments/prod/values.yaml`: name the SSO signing-key secret without storing its value.
- `projects/superset/image/Dockerfile`: pinned production Superset image.
- `projects/superset/image/loan_matrix_sso/token.py`: JWT verification and Redis replay protection.
- `projects/superset/image/loan_matrix_sso/security_manager.py`: custom POST-only login view and role reconciliation.
- `projects/superset/image/superset_config.py`: Superset production/security/session configuration.
- `projects/superset/image/bootstrap_roles.py`: idempotent constrained role bootstrap.
- `projects/superset/image/tests/test_token.py`: assertion verification tests.
- `projects/superset/image/tests/test_security_manager.py`: role-selection and consume-route tests.
- `projects/superset/helm-chart/Chart.yaml`: wrapper chart around official chart 0.15.5.
- `projects/superset/helm-chart/values.yaml`: safe common defaults.
- `projects/superset/helm-chart/templates/redis.yaml`: lightweight authenticated Redis.
- `projects/superset/helm-chart/templates/networking.yaml`: Istio gateway and virtual service.
- `projects/superset/helm-chart/templates/network-policy.yaml`: namespace ingress/egress restrictions.
- `projects/superset/environments/prod/values.yaml`: production image, resources, external services, and secret names.
- `projects/superset/argocd/project.yaml`: constrained Argo project.
- `projects/superset/argocd/applications/prod.yaml`: production Argo application.
- `argocd/applications/superset.yaml`: root application registration.
- `.github/workflows/superset-build.yml`: image test/build/push workflow.

---

### Task 1: Parse Tenant Superset Configuration

**Files:**
- Modify: `shared/types/tenant.ts`
- Create: `lib/superset-config.ts`
- Create: `lib/__tests__/superset-config.test.ts`

**Interfaces:**
- Produces: `getTenantSupersetConfig(settings: unknown): ResolvedTenantSupersetConfig`.
- Produces: `resolveSupersetRole(username: string | null | undefined, creatorUsernames: string[]): "viewer" | "creator"`.

- [ ] **Step 1: Write the failing configuration tests**

```ts
import assert from "node:assert/strict";
import { getTenantSupersetConfig, resolveSupersetRole } from "../superset-config";

assert.deepEqual(getTenantSupersetConfig(undefined), {
  enabled: false,
  baseUrl: null,
  creatorUsernames: [],
});
assert.equal(
  getTenantSupersetConfig({
    superset: {
      enabled: true,
      baseUrl: "https://analytics.kenacloanmatrix.com/",
      creatorUsernames: [" MIFOS ", "mifos", ""],
    },
  }).baseUrl,
  "https://analytics.kenacloanmatrix.com"
);
assert.equal(
  getTenantSupersetConfig({ superset: { enabled: true, baseUrl: "http://unsafe" } }).enabled,
  false
);
assert.equal(resolveSupersetRole("Mifos", ["mifos"]), "creator");
assert.equal(resolveSupersetRole("analyst", ["mifos"]), "viewer");
console.log("ok");
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `npx tsx lib/__tests__/superset-config.test.ts`

Expected: FAIL because `lib/superset-config.ts` does not exist.

- [ ] **Step 3: Add the tenant type and minimal parser**

```ts
export interface TenantSupersetSettings {
  enabled?: boolean;
  baseUrl?: string;
  creatorUsernames?: string[];
}

export interface ResolvedTenantSupersetConfig {
  enabled: boolean;
  baseUrl: string | null;
  creatorUsernames: string[];
}
```

The parser must accept only `https:` URLs, remove a trailing slash, trim/deduplicate lowercase creator usernames, and force `enabled: false` whenever the URL is absent or invalid.

- [ ] **Step 4: Run the focused test**

Run: `npx tsx lib/__tests__/superset-config.test.ts`

Expected: PASS and print `ok`.

---

### Task 2: Create Short-Lived SSO Assertions

**Files:**
- Create: `lib/superset-sso.ts`
- Create: `lib/__tests__/superset-sso.test.ts`

**Interfaces:**
- Consumes: role type from `lib/superset-config.ts`.
- Produces: `createSupersetAssertion(input: SupersetAssertionInput, privateKeyPem: string, now?: Date): Promise<string>`.
- Produces: `renderSupersetLaunchForm(baseUrl: string, assertion: string): string`.

- [ ] **Step 1: Write failing cryptographic and transport tests**

Generate an ephemeral RSA key pair inside the test with `jose.generateKeyPair`, export the private key, create an assertion, and verify these exact claims: issuer, audience, subject, username, tenant slug, role, unique non-empty `jti`, and `exp - iat === 60`. Assert the HTML form action equals `https://analytics.kenacloanmatrix.com/login/sso/consume`, uses `method="post"`, contains a hidden `assertion`, escapes special characters, and does not place the assertion in the action URL.

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `npx tsx lib/__tests__/superset-sso.test.ts`

Expected: FAIL because `lib/superset-sso.ts` does not exist.

- [ ] **Step 3: Implement assertion signing and safe HTML**

Use `SignJWT` and `importPKCS8` from `jose`, `crypto.randomUUID()` for `jti`, and an HTML-escape helper for the form action and hidden value. Set algorithm `RS256`, issuer `loan-matrix`, audience `loan-matrix-superset`, issued-at from `now`, and expiration at exactly 60 seconds.

- [ ] **Step 4: Run the focused test**

Run: `npx tsx lib/__tests__/superset-sso.test.ts`

Expected: PASS and print `ok`.

---

### Task 3: Enforce Authentication, Reports Access, and Tenant Isolation

**Files:**
- Create: `app/api/tenant/analytics/route.ts`
- Create: `app/api/analytics/launch/route.ts`
- Create: `lib/superset-launch-policy.ts`
- Create: `lib/__tests__/superset-launch-policy.test.ts`

**Interfaces:**
- Consumes: `getTenantSupersetConfig`, `resolveSupersetRole`, `createSupersetAssertion`, `renderSupersetLaunchForm`.
- Produces: `evaluateSupersetLaunchPolicy(input): SupersetLaunchDecision` as a pure, testable policy function.

- [ ] **Step 1: Write failing policy tests**

Cover: no session -> `401`; tenant mismatch between session tenant ID and resolved tenant -> `403`; Reports disabled -> `403`; Superset missing/disabled -> `404`; invalid configured URL -> `503`; authenticated Reports user -> viewer; case-insensitive `mifos` -> creator.

- [ ] **Step 2: Run the policy test and verify failure**

Run: `npx tsx lib/__tests__/superset-launch-policy.test.ts`

Expected: FAIL because the policy module is absent.

- [ ] **Step 3: Implement the pure policy and both routes**

`GET /api/tenant/analytics` returns only `{ enabled: true }` when the current session, current tenant, Reports flag, and Superset config all permit access; otherwise it returns `{ enabled: false }` without exposing `baseUrl` or creator usernames.

`POST /api/analytics/launch` resolves the same controls independently, requires `SUPERSET_SSO_PRIVATE_KEY`, signs the assertion using `session.user.userId`, `session.user.name`, `session.user.email`, tenant slug, and selected role, then returns `text/html; charset=utf-8` with `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, and `Content-Security-Policy: default-src 'none'; form-action <validated-origin>; script-src 'unsafe-inline'`.

Log structured fields only: event, tenant slug, username, role, decision, and reason. Never log the assertion or key.

- [ ] **Step 4: Run the policy test and typecheck route imports**

Run: `npx tsx lib/__tests__/superset-launch-policy.test.ts && npx tsc --noEmit`

Expected: PASS with no TypeScript errors.

---

### Task 4: Add Advanced Analytics to Reports

**Files:**
- Modify: `app/(application)/reports/page.tsx`
- Create: `lib/__tests__/superset-reports-entry.test.ts`

**Interfaces:**
- Consumes: `GET /api/tenant/analytics` returning `{ enabled: boolean }`.
- Launches: `POST /api/analytics/launch` in a new tab.

- [ ] **Step 1: Write a failing source-level UI contract test**

Read the Reports page source and assert it contains the copy `Advanced Analytics`, fetches `/api/tenant/analytics`, and renders a form with `action="/api/analytics/launch"`, `method="post"`, and `target="_blank"` only from state set by the enabled response.

- [ ] **Step 2: Run the test and verify failure**

Run: `npx tsx lib/__tests__/superset-reports-entry.test.ts`

Expected: FAIL because the entry point is absent.

- [ ] **Step 3: Implement the Reports entry point**

Fetch the sanitized availability endpoint on mount. Render a deliberate `Advanced Analytics` card above the report browser only when enabled, with copy explaining that dashboards open securely in a new tab. Use a native POST form so popup blockers do not prevent launch and server authorization remains authoritative.

- [ ] **Step 4: Verify tests, lint, and production build**

Run:

```bash
npx tsx lib/__tests__/superset-config.test.ts
npx tsx lib/__tests__/superset-sso.test.ts
npx tsx lib/__tests__/superset-launch-policy.test.ts
npx tsx lib/__tests__/superset-reports-entry.test.ts
npm run lint
npm run build
```

Expected: all commands exit `0`.

---

### Task 5: Wire the Loan Matrix Signing Secret in GitOps

**Files:**
- Modify: `projects/loan-matrix/helm-chart/templates/deployment.yaml`
- Modify: `projects/loan-matrix/helm-chart/values.yaml`
- Modify: `projects/loan-matrix/environments/prod/values.yaml`

**Interfaces:**
- Produces environment variable `SUPERSET_SSO_PRIVATE_KEY` from secret `loan-matrix-superset-sso`, key `private-key.pem`.
- Produces environment variables `SUPERSET_SSO_ISSUER=loan-matrix` and `SUPERSET_SSO_AUDIENCE=loan-matrix-superset`.

- [ ] **Step 1: Capture a failing Helm assertion**

Render the current Loan Matrix chart and assert the output does not yet contain `SUPERSET_SSO_PRIVATE_KEY`:

```bash
helm template loan-matrix-prod projects/loan-matrix/helm-chart \
  -f projects/loan-matrix/environments/prod/values.yaml > /tmp/loan-matrix-before.yaml
! rg -q 'SUPERSET_SSO_PRIVATE_KEY' /tmp/loan-matrix-before.yaml
```

- [ ] **Step 2: Add optional existing-secret values and deployment env wiring**

Add a disabled-by-default `supersetSso` values block with `existingSecret`, `privateKeyKey`, `issuer`, and `audience`. In production set only the secret/key names and public constants. Do not add secret data.

- [ ] **Step 3: Render and verify exact secret references**

```bash
helm template loan-matrix-prod projects/loan-matrix/helm-chart \
  -f projects/loan-matrix/environments/prod/values.yaml > /tmp/loan-matrix-after.yaml
rg -n 'SUPERSET_SSO_PRIVATE_KEY|loan-matrix-superset-sso|private-key.pem' /tmp/loan-matrix-after.yaml
```

Expected: all three values appear in the Deployment and no PEM content appears.

---

### Task 6: Build and Test the Superset SSO Extension

**Files:**
- Create: `projects/superset/image/Dockerfile`
- Create: `projects/superset/image/requirements-local.txt`
- Create: `projects/superset/image/loan_matrix_sso/__init__.py`
- Create: `projects/superset/image/loan_matrix_sso/token.py`
- Create: `projects/superset/image/loan_matrix_sso/security_manager.py`
- Create: `projects/superset/image/superset_config.py`
- Create: `projects/superset/image/bootstrap_roles.py`
- Create: `projects/superset/image/tests/test_token.py`
- Create: `projects/superset/image/tests/test_security_manager.py`

**Interfaces:**
- Consumes: POST field `assertion` and env `LOAN_MATRIX_SSO_PUBLIC_KEY`, `LOAN_MATRIX_SSO_ISSUER`, `LOAN_MATRIX_SSO_AUDIENCE`, `LOAN_MATRIX_SSO_ALLOWED_TENANT`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.
- Produces: Superset route `/login/sso/consume`.

- [ ] **Step 1: Write failing Python tests**

Test a valid RS256 token, wrong signature, issuer, audience, tenant, expiry, missing `jti`, and replay. Use an in-memory fake exposing `set(name, value, nx=True, ex=ttl)` and assert a second use of the same `jti` raises `AssertionReplayError`. Test role selection maps only exact normalized creator assertions to `LoanMatrixCreator`, all others to `LoanMatrixViewer`.

- [ ] **Step 2: Run tests and verify missing-module failure**

Run: `python3 -m pytest projects/superset/image/tests -q`

Expected: FAIL because `loan_matrix_sso` is absent.

- [ ] **Step 3: Implement verification, replay protection, and login view**

`verify_assertion()` must call `jwt.decode(..., algorithms=["RS256"], issuer=..., audience=..., options={"require": ["exp", "iat", "jti", "sub"]})`, require tenant `goodfellow`, require role in `{viewer, creator}`, and atomically reserve `lm-sso:<jti>` with Redis NX and an expiry no longer than the assertion lifetime.

The custom AuthDB view accepts POST only, verifies the assertion, finds or creates the user, removes stale `LoanMatrixViewer`/`LoanMatrixCreator` assignments, assigns exactly one requested role, calls Flask-Login `login_user`, and redirects to `/superset/welcome/`. Invalid assertions render a friendly 401 page without exposing token details.

- [ ] **Step 4: Configure security and constrained roles**

Set `CUSTOM_SECURITY_MANAGER`, secure cookies, `PERMANENT_SESSION_LIFETIME = timedelta(minutes=30)`, CSRF protection, proxy fix, and production metadata/cache URIs from environment variables. Bootstrap `LoanMatrixViewer` from Gamma's read permissions and `LoanMatrixCreator` from approved dashboard/chart/dataset write permissions while explicitly excluding database, security, user, role, SQL Lab, and Admin permissions.

- [ ] **Step 5: Run tests and build the image**

```bash
python3 -m pytest projects/superset/image/tests -q
docker build -t loan-matrix-superset:6.1.0-sso-test projects/superset/image
```

Expected: tests pass and image build exits `0`.

---

### Task 7: Add the Superset Production GitOps Application

**Files:**
- Create: `projects/superset/helm-chart/Chart.yaml`
- Create: `projects/superset/helm-chart/values.yaml`
- Create: `projects/superset/helm-chart/templates/redis.yaml`
- Create: `projects/superset/helm-chart/templates/networking.yaml`
- Create: `projects/superset/helm-chart/templates/network-policy.yaml`
- Create: `projects/superset/environments/prod/values.yaml`
- Create: `projects/superset/argocd/project.yaml`
- Create: `projects/superset/argocd/applications/prod.yaml`
- Create: `argocd/applications/superset.yaml`
- Create: `.github/workflows/superset-build.yml`

**Interfaces:**
- Consumes: secret `superset-prod-env` and TLS credential `kenacloanmatrix-tls-secret` or the validated existing equivalent.
- Produces: namespace `superset-prod`, service, Redis, and route for `analytics.kenacloanmatrix.com`.

- [ ] **Step 1: Add the pinned chart dependency and conservative defaults**

Use official dependency `superset` version `0.15.5`. Disable chart PostgreSQL, Redis, worker, and beat. Configure one web replica, external secret env, migration/init job, readiness/liveness probes, and explicit CPU/memory requests and limits.

- [ ] **Step 2: Add lightweight Redis and network routing**

Deploy one Redis replica with an `emptyDir`, password from `superset-prod-env`, readiness/liveness probes, and conservative resources. Add Istio routing for only `analytics.kenacloanmatrix.com` and network policies permitting ingress from the mesh and egress to DNS, Redis, and the production PostgreSQL endpoint.

- [ ] **Step 3: Add Argo CD registration and image workflow**

The workflow runs Python tests, builds from `projects/superset/image`, pushes `ghcr.io/kenac-innovations/superset:6.1.0-sso-${SHORT_SHA}`, and updates only the image tag in `projects/superset/environments/prod/values.yaml`.

- [ ] **Step 4: Render and validate manifests**

```bash
helm dependency build projects/superset/helm-chart
helm template superset-prod projects/superset/helm-chart \
  -f projects/superset/environments/prod/values.yaml > /tmp/superset-prod.yaml
kubectl apply --dry-run=client -f /tmp/superset-prod.yaml >/dev/null
rg -n 'postgresql.enabled: true|supersetWorker|supersetCeleryBeat' /tmp/superset-prod.yaml && exit 1 || true
```

Expected: rendering and dry-run succeed, with no PostgreSQL, Celery worker, or beat workload.

---

### Task 8: Provision Production Dependencies and Deploy Disabled

**Files:**
- Runtime resources only; no credentials are written to repository files.

**Interfaces:**
- Produces PostgreSQL database/user for Superset metadata.
- Produces read-only Goodfellow database users.
- Produces Kubernetes secrets in `loan-matrix-prod` and `superset-prod`.

- [ ] **Step 1: Verify the production context and existing services**

Run `kubectl config current-context`, inspect the PostgreSQL service path to `10.10.198.40:6432`, verify the Goodfellow Fineract database name, and confirm the TLS issuer/secret pattern. Stop if the context is not production or the database identity differs from the approved target.

- [ ] **Step 2: Create least-privilege PostgreSQL roles**

Create a dedicated Superset metadata database and owner. Create separate read-only users for `loan_matrix_prod` and the verified Goodfellow Fineract database, then grant only `CONNECT`, `USAGE` on reporting schemas, `SELECT` on existing tables, and matching default privileges. Prove write denial by running a rolled-back or harmless `CREATE TABLE` attempt as each read-only user and expecting permission denied.

- [ ] **Step 3: Generate and install runtime secrets**

Generate a 3072-bit RSA key pair, a high-entropy Superset `SECRET_KEY`, Redis password, metadata password, and read-only passwords. Create/update `loan-matrix-prod/loan-matrix-superset-sso` and `superset-prod/superset-prod-env` through `kubectl create secret ... --dry-run=client -o yaml | kubectl apply -f -`. Do not print secret values in logs or responses.

- [ ] **Step 4: Deploy Superset while tenant access remains disabled**

Synchronize the Superset Argo application, wait for migrations and the web pod, verify `https://analytics.kenacloanmatrix.com/health` returns success, and confirm direct `/login/sso/consume` GET is rejected. Confirm Goodfellow `Tenant.settings.superset.enabled` is still false or absent.

---

### Task 9: Enable Goodfellow and Verify End-to-End Authorization

**Files:**
- Runtime database setting only.

**Interfaces:**
- Updates only tenant slug `goodfellow`.

- [ ] **Step 1: Apply the Goodfellow tenant setting safely**

```sql
UPDATE "Tenant"
SET settings = jsonb_set(
  COALESCE(settings::jsonb, '{}'::jsonb),
  '{superset}',
  '{"enabled":true,"baseUrl":"https://analytics.kenacloanmatrix.com","creatorUsernames":["mifos"]}'::jsonb,
  true
)
WHERE slug = 'goodfellow';
```

Assert exactly one row changed, then query all active tenants and confirm only Goodfellow has `settings->'superset'->>'enabled' = 'true'`.

- [ ] **Step 2: Verify viewer and creator behavior**

Using authenticated browser sessions, verify a normal Goodfellow Reports user sees Advanced Analytics and lands in Superset as `LoanMatrixViewer`; verify `mifos` lands as `LoanMatrixCreator`, can create/edit charts and dashboards, and cannot access security, users/roles, databases, or SQL Lab.

- [ ] **Step 3: Verify tenant isolation and failure paths**

Verify a non-Goodfellow tenant does not render the link and receives `404` from the launch route. Verify replaying one captured test assertion is rejected, expired assertions are rejected, and assertions never appear in ingress URL logs.

- [ ] **Step 4: Verify rollback**

Temporarily set `settings.superset.enabled` to false, verify the link disappears and launch returns `404`, then restore it to true. Record pod health, memory/CPU, PostgreSQL connection count, and authentication errors after the smoke test.

---

## Final Verification

- [ ] Run all Loan Matrix Superset tests, full lint, TypeScript check, and production build from the isolated Loan Matrix worktree.
- [ ] Run all Superset Python tests and rebuild the exact production image tag.
- [ ] Render both Loan Matrix and Superset production Helm output and validate it with `kubectl --dry-run=client`.
- [ ] Inspect `git diff --check` in both repositories.
- [ ] Confirm no private key, password, JWT, or Superset secret appears in either Git diff.
- [ ] Confirm Goodfellow viewer, `mifos` creator, and another tenant all exhibit the approved authorization behavior.
- [ ] Confirm rollback through the Goodfellow tenant setting succeeds.
