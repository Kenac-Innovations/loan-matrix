# Goodfellow Superset External Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Goodfellow Reports users a database-controlled link to the existing Superset instance at `https://apachesupersetgoodfellow.kenac.tech/analytics` without changing Istio control-plane components or introducing shared SSO.

**Architecture:** Loan Matrix continues to resolve the Goodfellow-only `Tenant.settings.superset` policy on the server, but the Reports page receives the validated URL and opens it as a normal external link. The Superset Helm release publishes one exact hostname through a dedicated HTTP origin Gateway and VirtualService, matching the established Cloudflare-to-Istio pattern for `*.kenac.tech`; Superset keeps its existing `/analytics` application root and its own authentication.

**Tech Stack:** Next.js 15, TypeScript, React, Node assertion tests, Helm 3, Istio Gateway/VirtualService, Pytest, Kubernetes, Argo CD.

## Global Constraints

- The external URL is exactly `https://apachesupersetgoodfellow.kenac.tech/analytics` after trailing-slash normalization.
- Only the `goodfellow` tenant may receive the Reports action.
- The action is available only when Reports and `Tenant.settings.superset.enabled` are enabled.
- Open Superset with `target="_blank"` and `rel="noopener noreferrer"`; do not send a Loan Matrix SSO assertion or session.
- Superset remains mounted at `/analytics`; do not rewrite that prefix.
- Redirect only the exact hostname root `/` to `/analytics/`.
- Do not change, restart, move, scale, or reconfigure the Istio control plane.
- Do not remove the existing `goodfellow.kenac.tech/analytics` route.
- Apply cluster resources only through GitOps; do not directly patch production.
- Keep the Goodfellow database flag disabled until the public hostname and health endpoint are verified.
- Do not modify another tenant's settings.

---

### Task 1: Expose The Validated External URL To Reports

**Files:**
- Modify: `lib/__tests__/superset-config.test.ts`
- Modify: `lib/__tests__/superset-launch-policy.test.ts`
- Modify: `lib/__tests__/superset-reports-entry.test.ts`
- Modify: `lib/superset-config.ts`
- Modify: `app/api/tenant/analytics/route.ts`
- Modify: `app/(application)/reports/page.tsx`

**Interfaces:**
- Consumes: `resolveSupersetRequestContext(request)` and its allowed decision containing `baseUrl`.
- Produces: `GET /api/tenant/analytics` response `{ enabled: true, url: string }` for permitted Goodfellow users; the Reports page renders a safe external anchor.

- [ ] **Step 1: Change the tests to require the new hostname and external-link behavior**

  Update the Goodfellow fixture URL to `https://apachesupersetgoodfellow.kenac.tech/analytics`, require the tenant API source to return `url: decision.baseUrl`, require the Reports page to render `href={analyticsUrl}`, `target="_blank"`, and `rel="noopener noreferrer"`, and assert the page no longer posts to `/api/analytics/launch`.

- [ ] **Step 2: Run the focused tests and verify the expected failures**

  Run:

  ```bash
  npx tsx lib/__tests__/superset-config.test.ts
  npx tsx lib/__tests__/superset-launch-policy.test.ts
  npx tsx lib/__tests__/superset-reports-entry.test.ts
  ```

  Expected: the configuration test rejects the new hostname and the Reports entry test fails because the URL is not returned or rendered yet.

- [ ] **Step 3: Implement the minimal external-link behavior**

  Set `GOODFELLOW_SUPERSET_BASE_URL` to the new URL. Return `url: decision.baseUrl` from the allowed tenant analytics response. Replace the boolean page state with `analyticsUrl: string | null`, accept only a non-empty HTTPS URL from the server response, and render:

  ```tsx
  <Button asChild>
    <a href={analyticsUrl} target="_blank" rel="noopener noreferrer">
      Open Advanced Analytics
      <ExternalLink className="ml-2 h-4 w-4" />
    </a>
  </Button>
  ```

  Update the explanatory copy to say Superset opens separately and may request its own login.

- [ ] **Step 4: Run the focused tests and verify they pass**

  Run the three `npx tsx` commands from Step 2.

  Expected: all print `ok` and exit zero.

- [ ] **Step 5: Run application verification**

  Run:

  ```bash
  npm run lint
  npm run build
  ```

  Expected: both exit zero with no new type or build errors.

- [ ] **Step 6: Commit the application change**

  ```bash
  git add lib/__tests__/superset-config.test.ts lib/__tests__/superset-launch-policy.test.ts lib/__tests__/superset-reports-entry.test.ts lib/superset-config.ts app/api/tenant/analytics/route.ts 'app/(application)/reports/page.tsx'
  git commit -m "feat(reports): open Goodfellow Superset externally"
  ```

### Task 2: Publish The Dedicated Superset Hostname Through GitOps

**Files:**
- Modify: `projects/superset/image/tests/test_dockerfile.py`
- Modify: `projects/superset/helm-chart/templates/networking.yaml`
- Modify: `projects/superset/environments/prod/values.yaml`

**Interfaces:**
- Consumes: the existing `superset` Kubernetes Service on port `8088` and Superset's `/analytics` application root.
- Produces: exact host `apachesupersetgoodfellow.kenac.tech`, root redirect to `/analytics/`, and routing for `/analytics` plus `/analytics/*`.

- [ ] **Step 1: Change the GitOps tests to require the dedicated hostname route**

  Replace the old assertion that production cannot publish a hostname with assertions that production enables only the exact hostname and leaves TLS disabled at the origin. Add source assertions requiring an exact `/` redirect and exact/prefix `/analytics` route matches.

- [ ] **Step 2: Run the focused GitOps tests and verify they fail**

  Run:

  ```bash
  pytest projects/superset/image/tests/test_dockerfile.py -q
  ```

  Expected: failure because `istio.enabled` is false and the hostname/redirect are absent.

- [ ] **Step 3: Implement the route without touching the Istio control plane**

  Configure production values as:

  ```yaml
  istio:
    enabled: true
    gatewaySelector:
      istio: gateway
    host: apachesupersetgoodfellow.kenac.tech
    tls:
      enabled: false
      credentialName: ""
  ```

  In the Superset VirtualService, add the exact `/` redirect first, then route exact `/analytics` and prefix `/analytics/` to `superset:8088` without a rewrite. Keep the dedicated Gateway HTTP-only because Cloudflare terminates public TLS for the existing `*.kenac.tech` pattern.

- [ ] **Step 4: Run tests and render the Helm release**

  Run:

  ```bash
  pytest projects/superset/image/tests -q
  helm template superset projects/superset/helm-chart \
    --namespace superset-prod \
    --values projects/superset/environments/prod/values.yaml \
    > /tmp/superset-prod-rendered.yaml
  ```

  Expected: tests pass and Helm exits zero.

- [ ] **Step 5: Inspect the rendered routing contract**

  Run:

  ```bash
  rg -n -C 8 'apachesupersetgoodfellow|redirect:|uri: /analytics|host: superset' /tmp/superset-prod-rendered.yaml
  ```

  Expected: one exact hostname, one root redirect to `/analytics/`, and one route to `superset:8088`; no path rewrite and no TLS credential.

- [ ] **Step 6: Commit the GitOps change**

  ```bash
  git add projects/superset/image/tests/test_dockerfile.py projects/superset/helm-chart/templates/networking.yaml projects/superset/environments/prod/values.yaml
  git commit -m "feat(superset): publish Goodfellow analytics hostname"
  ```

### Task 3: Stage And Verify The Production Rollout

**Files:**
- Modify: `projects/loan-matrix/environments/prod/values.yaml` only if a new Loan Matrix image tag is produced.
- Modify: Goodfellow `Tenant.settings.superset` database JSON only after hostname verification.

**Interfaces:**
- Consumes: the verified Loan Matrix image, committed Superset GitOps route, Argo CD applications, and Goodfellow tenant settings.
- Produces: a visible Reports action for Goodfellow users and no change for other tenants.

- [ ] **Step 1: Build and scan the Loan Matrix image without changing the running deployment**

  Build the application commit into a uniquely tagged immutable image, then run the repository's established image/security checks. Record the tag and digest before updating GitOps.

- [ ] **Step 2: Update only the Loan Matrix production image tag in GitOps**

  Change only `projects/loan-matrix/environments/prod/values.yaml` to the verified immutable image tag and inspect the resulting diff to ensure replicas, resources, probes, Istio, and unrelated applications are unchanged.

- [ ] **Step 3: Push the reviewed source and GitOps branches**

  Push the Loan Matrix branch and GitOps branch only after all local tests, builds, Helm rendering, and diff checks pass.

- [ ] **Step 4: Monitor Argo and workload health**

  Confirm the Loan Matrix and Superset applications are `Synced` and `Healthy`, Superset remains `1/1`, Loan Matrix reaches its prior healthy replica count, and no Istio control-plane workload changes.

- [ ] **Step 5: Verify the public hostname before enabling the link**

  Run:

  ```bash
  curl -sSIL https://apachesupersetgoodfellow.kenac.tech/
  curl -sS -o /dev/null -w '%{http_code}\n' https://apachesupersetgoodfellow.kenac.tech/analytics/health
  curl -sSIL https://apachesupersetgoodfellow.kenac.tech/analytics/
  ```

  Expected: `/` redirects to `/analytics/`, health returns `200`, and `/analytics/` reaches the Superset login/welcome flow rather than `404` or `502`.

- [ ] **Step 6: Enable only Goodfellow's database configuration**

  Merge the following block into Goodfellow's existing `Tenant.settings` JSON without replacing unrelated keys:

  ```json
  {
    "superset": {
      "enabled": true,
      "baseUrl": "https://apachesupersetgoodfellow.kenac.tech/analytics",
      "creatorUsernames": ["mifos"]
    }
  }
  ```

- [ ] **Step 7: Verify tenant isolation and rollback readiness**

  Confirm a Goodfellow Reports user sees the action and it opens Superset in a new tab. Confirm a non-Goodfellow tenant does not see the action. Recheck Argo/workload health, and retain the rollback procedure: set Goodfellow `settings.superset.enabled` to `false` and revert the dedicated hostname commit.
