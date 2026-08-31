# ARDA Dedicated Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy ARDA as an independent Loan Matrix runtime at `ardaloanmatrix.kenac.tech`, built from the `ARDA` branch and GitOps-managed from the `prod` branch.

**Architecture:** The Loan Matrix application repository publishes an ARDA-tagged image and updates an ARDA-only values file on the GitOps `prod` branch. A dedicated Argo CD application deploys it into `loan-matrix-arda`; it shares the production database but resolves only the ARDA tenant through an explicit hostname alias.

**Tech Stack:** Next.js, NextAuth, TypeScript, GitHub Actions, Helm, Argo CD, Istio, cert-manager, PostgreSQL, Apache Fineract.

**Spec:** `docs/superpowers/specs/2026-08-21-arda-dedicated-deployment-design.md`

## Global Constraints

- ARDA is a dedicated deployment, namespace, service, and hostname.
- GitOps deploys ARDA from the `prod` branch only.
- The Loan Matrix `ARDA` branch is the only branch that updates the ARDA image tag.
- Existing `loan-matrix-prod`, `dev`, `qa`, and `uat` deployments are not changed.
- ARDA uses the existing production database through its isolated tenant record.
- The production NextAuth secret is stored in Kubernetes, not Git.
- `ardaloanmatrix.kenac.tech` resolves explicitly to tenant slug `arda`.

---

### Task 1: Add ARDA Hostname and Feature Isolation

**Files:**
- Create: `lib/arda-tenant.ts`
- Modify: `lib/tenant-service.ts`
- Modify: `lib/auth.ts`
- Modify: ARDA inventory modules that currently use `isOmamaTenantSlug`
- Create: `lib/__tests__/arda-tenant-hostname.test.ts`

**Interfaces:**
- Produces: `isArdaTenantSlug(slug?: string | null): boolean`
- Produces: hostname alias `ardaloanmatrix.kenac.tech -> arda`

- [ ] **Step 1: Write the failing test**

```ts
import { extractTenantSlug } from "@/lib/tenant-service";
import { isArdaTenantSlug } from "@/lib/arda-tenant";

test("maps the ARDA hostname to the ARDA tenant", () => {
  expect(extractTenantSlug("ardaloanmatrix.kenac.tech")).toBe("arda");
  expect(isArdaTenantSlug("arda")).toBe(true);
  expect(isArdaTenantSlug("omama")).toBe(false);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm exec tsx --test lib/__tests__/arda-tenant-hostname.test.ts`

Expected: FAIL because the ARDA predicate and hostname alias do not exist.

- [ ] **Step 3: Implement the hostname alias and ARDA predicate**

```ts
const HOSTNAME_TENANT_ALIASES: Record<string, string> = {
  "ardaloanmatrix.kenac.tech": "arda",
};

export function isArdaTenantSlug(slug?: string | null): boolean {
  return (slug || "").trim().toLowerCase() === "arda";
}
```

Resolve aliases before the existing generic subdomain fallback. Add `.kenac.tech` to the existing NextAuth callback host allowlist. Replace only ARDA feature checks that incorrectly call `isOmamaTenantSlug`.

- [ ] **Step 4: Run the targeted tests**

Run: `pnpm exec tsx --test lib/__tests__/arda-tenant-hostname.test.ts lib/__tests__/arda-stock-loan.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tenant-service.ts lib/auth.ts lib/arda-tenant.ts lib/inventory app lib/__tests__
git commit -m "feat: isolate ARDA tenant deployment"
```

### Task 2: Publish ARDA Branch Images

**Files:**
- Modify: `.github/workflows/main.yml`

**Interfaces:**
- Consumes: push to `ARDA`
- Produces: `ghcr.io/kenac-innovations/loan-matrix:ARDA-<short-sha>`
- Produces: update to `projects/loan-matrix/environments/arda/values.yaml` on GitOps `prod`

- [ ] **Step 1: Confirm no ARDA mapping currently exists**

Run: `rg -n 'ARDA|environment=arda|environments/arda' .github/workflows/main.yml`

Expected: no matches.

- [ ] **Step 2: Add ARDA to the workflow trigger and branch mapping**

```bash
elif [[ "$BRANCH_NAME" == "ARDA" ]]; then
  echo "environment=arda" >> "$GITHUB_OUTPUT"
  echo "is_deploy_branch=true" >> "$GITHUB_OUTPUT"
fi
```

Add `ARDA` to every deployment-branch list and publishing condition. When `ENV` is `arda`, fetch and check out GitOps `prod` before updating `projects/loan-matrix/environments/arda/values.yaml`.

- [ ] **Step 3: Verify the static workflow contract**

Run: `rg -n 'ARDA|environment=arda|environments/arda|git checkout prod' .github/workflows/main.yml`

Expected: trigger, branch mapping, values path, and GitOps production checkout are present.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/main.yml
git commit -m "ci: publish ARDA deployment images"
```

### Task 3: Create Dedicated ARDA GitOps Resources

**Files:**
- Create: `/Users/dazzmurenga/Documents/kenac-gitops/projects/loan-matrix/environments/arda/values.yaml`
- Create: `/Users/dazzmurenga/Documents/kenac-gitops/projects/loan-matrix/argocd/applications/arda.yaml`
- Modify: `/Users/dazzmurenga/Documents/kenac-gitops/infrastructure/namespace-guardrails/values.yaml`

**Interfaces:**
- Produces: Argo CD application `loan-matrix-arda`
- Produces: namespace `loan-matrix-arda`
- Produces: TLS host `ardaloanmatrix.kenac.tech`

- [ ] **Step 1: Add environment values**

```yaml
fullnameOverride: loan-matrix-arda
replicaCount: 2
image:
  repository: ghcr.io/kenac-innovations/loan-matrix
  tag: "ARDA-REPLACE-WITH-FIRST-BUILD"
auth:
  enabled: true
istio:
  enabled: true
  gateway:
    enabled: true
    hosts:
      - "ardaloanmatrix.kenac.tech"
    tlsCredentials:
      - name: "https-ardaloanmatrix"
        credentialName: "ardaloanmatrix-tls-cert"
        hosts:
          - "ardaloanmatrix.kenac.tech"
certificates:
  enabled: true
  items:
    - name: "ardaloanmatrix-tls-cert"
      secretName: "ardaloanmatrix-tls-cert"
      dnsNames:
        - "ardaloanmatrix.kenac.tech"
```

Set the database, Fineract, AMQP, CDE, and document-service URLs to the existing production values. Do not edit `environments/prod/values.yaml`.

- [ ] **Step 2: Add the Argo CD application**

```yaml
spec:
  project: loan-matrix
  source:
    repoURL: https://github.com/Kenac-Innovations/kenac-gitops
    targetRevision: prod
    path: projects/loan-matrix/helm-chart
    helm:
      valueFiles:
        - ../environments/arda/values.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: loan-matrix-arda
```

Use the same automated sync, prune, self-heal, and retry configuration as the existing production application.

- [ ] **Step 3: Add the namespace guardrail**

```yaml
  - name: loan-matrix-arda
```

- [ ] **Step 4: Render and verify isolation**

Run: `helm template loan-matrix-arda projects/loan-matrix/helm-chart -n loan-matrix-arda -f projects/loan-matrix/environments/arda/values.yaml > /tmp/loan-matrix-arda.yaml`

Expected: rendered resources target `loan-matrix-arda`, contain `ardaloanmatrix.kenac.tech`, and do not contain `loan-matrix-prod`.

- [ ] **Step 5: Commit and push on the GitOps production branch**

```bash
git checkout prod
git add projects/loan-matrix/environments/arda/values.yaml projects/loan-matrix/argocd/applications/arda.yaml infrastructure/namespace-guardrails/values.yaml
git commit -m "feat: deploy dedicated ARDA loan matrix application"
git push origin prod
```

### Task 4: Provision Secret, Sync, and Verify

**Files:**
- No repository file changes.

**Interfaces:**
- Consumes: `loan-matrix-arda-auth` Kubernetes secret and `Tenant.slug = "arda"`
- Produces: an authenticated ARDA deployment at the public hostname.

- [ ] **Step 1: Create the ARDA NextAuth secret**

```bash
kubectl -n loan-matrix-arda create secret generic loan-matrix-arda-auth \
  --from-literal=nextauth-secret="$(openssl rand -base64 48)"
```

- [ ] **Step 2: Confirm the production tenant record**

```sql
SELECT id, name, slug FROM "Tenant" WHERE slug = 'arda';
```

Expected: exactly one ARDA tenant record.

- [ ] **Step 3: Sync and wait for health**

Run: `argocd app sync loan-matrix-arda && argocd app wait loan-matrix-arda --health --sync --timeout 600`

Expected: `Synced` and `Healthy`.

- [ ] **Step 4: Verify public routing and tenant isolation**

Run: `curl -I https://ardaloanmatrix.kenac.tech/auth/login`

Expected: HTTP `200` or valid login redirect, never `404` or `503`.

Open the public hostname, sign in, and confirm ARDA branding and inventory. Open a normal Loan Matrix hostname and confirm ARDA inventory remains unavailable.

- [ ] **Step 5: Confirm independent runtime resources**

Run: `kubectl -n loan-matrix-arda get deploy,svc,pods`

Expected: only ARDA resources are listed. Confirm `loan-matrix-prod` deployment generation did not change.
