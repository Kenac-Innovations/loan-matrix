# ARDA Dedicated Deployment Design

## Goal

Run ARDA as an independently deployable Loan Matrix application at `ardaloanmatrix.kenac.tech`, while retaining the existing production Loan Matrix database and separating ARDA runtime resources from the standard Loan Matrix production deployment.

## Approved Architecture

ARDA will use the existing Loan Matrix container image and Helm chart but receive its own Argo CD application, namespace, deployment, service, gateway, virtual service, certificate, and NextAuth configuration. The Argo CD application will track the `prod` branch of `kenac-gitops`. The Loan Matrix `ARDA` branch will build an `ARDA-<commit>` image and update only the ARDA values file on the GitOps `prod` branch.

ARDA will use `loan_matrix_prod` and access only records belonging to the ARDA tenant. No existing production Loan Matrix deployment, tenant, user, workflow, or contract configuration will be copied, changed, or removed.

## Data Flow

```text
ARDA branch push
  -> GitHub Actions builds ghcr.io/kenac-innovations/loan-matrix:ARDA-<sha>
  -> GitHub Actions updates GitOps prod/projects/loan-matrix/environments/arda/values.yaml
  -> Argo CD loan-matrix-arda application syncs
  -> loan-matrix-arda namespace serves ardaloanmatrix.kenac.tech
  -> Hostname resolves tenant slug "arda" in loan_matrix_prod
```

## Required Application Behaviour

- `ardaloanmatrix.kenac.tech` must be accepted by NextAuth callback validation.
- The hostname must explicitly resolve to `Tenant.slug = "arda"`; the generic resolver would otherwise look for `ardaloanmatrix`.
- ARDA inventory and agricultural-input functionality must use an ARDA-specific predicate. Omama-specific policies must remain Omama-only.
- The existing host-based tenant model remains unchanged for all other tenants.

## Required GitOps Resources

- Add `loan-matrix-arda` to namespace guardrails.
- Add an Argo CD application named `loan-matrix-arda` with destination namespace `loan-matrix-arda`, tracking `prod`.
- Add `projects/loan-matrix/environments/arda/values.yaml` with its own service name, host, certificate, database URL, Fineract configuration, AMQP configuration, and NextAuth secret reference.
- The dedicated ARDA application must use its own Kubernetes secret for `NEXTAUTH_SECRET`; no secret is committed to Git.
- Existing `dev`, `qa`, `uat`, and `prod` values must not be modified.

## Acceptance Criteria

- A push to `ARDA` publishes an ARDA-tagged image and updates GitOps only on its `prod` branch.
- Argo CD creates only resources in `loan-matrix-arda`.
- `https://ardaloanmatrix.kenac.tech/auth/login` reaches the ARDA application.
- The hostname selects the ARDA tenant and never an Omama tenant.
- Normal production Loan Matrix continues unchanged.
