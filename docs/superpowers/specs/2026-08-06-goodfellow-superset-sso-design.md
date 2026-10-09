# Goodfellow Superset SSO Design

## Summary

Deploy Apache Superset in the production cluster and expose it from the Loan Matrix Reports area for the Goodfellow tenant only. Access is controlled by the existing database-backed tenant settings JSON rather than hostname checks or global environment flags.

Every authenticated Goodfellow user who can access Loan Matrix Reports receives view-only Superset access. The Loan Matrix username `mifos` receives dashboard and chart creation/editing access, but not Superset security or infrastructure administration.

## Goals

- Add an Advanced Analytics link in the Loan Matrix Reports area.
- Enable the link and SSO launch endpoint only for tenants with Superset enabled in database tenant settings.
- Provide seamless SSO from the existing Loan Matrix/Fineract session.
- Make report users view-only by default.
- Allow configured creator usernames, initially only `mifos`, to create and edit Superset analytics content.
- Deploy Superset through production GitOps with TLS, persistent metadata, and conservative resource usage.
- Restrict initial reporting data access to Goodfellow.

## Non-Goals

- Migrating Loan Matrix authentication to Keycloak.
- Providing Superset access to other Loan Matrix tenants.
- Enabling Superset administration for `mifos`.
- Enabling scheduled reports, alerts, Celery workers, or Celery beat in the initial release.
- Providing unrestricted SQL Lab or database-management access.
- Implementing central single logout between Loan Matrix and Superset.

## Selected Approach

Use a short-lived signed SSO bridge between Loan Matrix and a custom Superset security extension.

Loan Matrix already authenticates users directly against Fineract through NextAuth and is not an OpenID Connect identity provider. A native Superset OIDC integration would therefore require a wider authentication migration. The signed bridge preserves the existing login experience while limiting the change to the Reports-to-Superset handoff.

### Rejected Alternatives

1. Keycloak/OIDC for both applications: architecturally standard, but requires migrating or synchronizing Loan Matrix users and changing its current authentication flow.
2. Separate Superset credentials: simpler to deploy but fails the shared SSO requirement and creates a second user lifecycle.

## Tenant Configuration

Extend the existing `TenantSettings` type with an optional Superset block:

```ts
interface TenantSupersetSettings {
  enabled?: boolean;
  baseUrl?: string;
  creatorUsernames?: string[];
}

interface TenantSettings {
  // Existing settings remain unchanged.
  superset?: TenantSupersetSettings;
}
```

Goodfellow production settings will include:

```json
{
  "superset": {
    "enabled": true,
    "baseUrl": "https://analytics.kenacloanmatrix.com",
    "creatorUsernames": ["mifos"]
  }
}
```

The application normalizes creator usernames to lowercase before comparison. A missing block, `enabled: false`, or an invalid `baseUrl` disables both the UI entry point and the server-side launch route. Other tenants remain unaffected without requiring explicit negative configuration.

## Loan Matrix Components

### Reports Entry Point

Add an `Advanced Analytics` action to the existing Reports page. It is visible only when:

- the current tenant has `settings.superset.enabled === true`;
- `settings.superset.baseUrl` is a valid HTTPS URL; and
- the current user has access to the Reports area under the existing Reports access rules.

The action opens the SSO launch route in a new browser tab. The same Reports page implementation serves desktop and mobile layouts, avoiding duplicate navigation authorization logic.

### SSO Launch Route

Add a server-side route such as `POST /api/analytics/launch`. It must:

1. Resolve the current NextAuth session and tenant.
2. Reject unauthenticated users.
3. Re-evaluate Reports access server-side.
4. Load and validate the tenant's Superset database configuration.
5. Assign role `creator` only when the normalized username is in `creatorUsernames`; otherwise assign `viewer`.
6. Create a signed JWT with a maximum lifetime of 60 seconds.
7. Return an auto-submitting HTML form that POSTs the token to Superset's SSO consume endpoint.

The JWT contains only the identity and authorization data needed for provisioning:

- issuer and audience;
- subject and username;
- display name and email when available;
- tenant slug;
- requested role;
- issued-at and expiry timestamps;
- unique `jti` for replay prevention.

Loan Matrix signs with an asymmetric private key. Superset receives only the public verification key.

### Audit Logging

Log successful and rejected SSO launch attempts with tenant, username, selected role, timestamp, and reason. Never log the signed token or signing key.

## Superset Authentication and Authorization

Build a small custom Superset image extending the pinned official image. It contains a custom `SupersetSecurityManager` and SSO consume view.

The consume view:

1. Accepts the assertion only through POST.
2. Verifies signature, issuer, audience, expiry, and the Goodfellow tenant slug.
3. Atomically stores the JWT `jti` in Redis until expiry and rejects reuse.
4. Creates or updates the Superset user.
5. Maps `viewer` to a custom `LoanMatrixViewer` role based on the minimum Gamma permissions and approved dashboards/datasets.
6. Maps `creator` to a custom `LoanMatrixCreator` role containing only the approved chart, dashboard, and dataset editing permissions, without Superset Admin, SQL Lab, security, or database-management privileges.
7. Establishes the normal Superset session.
8. Redirects immediately to a clean Superset URL so the assertion is not retained in browser history.

Direct requests with missing, forged, expired, wrong-tenant, wrong-audience, or replayed assertions are denied.

## Production Deployment

Deploy into a dedicated `superset-prod` namespace through the production GitOps repository.

### Workloads

- One Superset web replica initially, with readiness and liveness probes.
- One lightweight Redis instance for session/cache support and assertion replay protection.
- A migration/bootstrap job synchronized before the web deployment becomes ready.
- No Celery worker or beat deployment in the initial release.

### Persistence

- Use a dedicated Superset metadata database and database user on the existing production PostgreSQL service.
- Do not use the Helm chart's development PostgreSQL dependency.
- Configure Goodfellow reporting data sources with read-only database credentials.

### Networking

- Host: `analytics.kenacloanmatrix.com`.
- TLS issued through the cluster's existing certificate-management pattern.
- Route through the existing production ingress/Istio pattern.
- Redact assertion-bearing paths and request bodies from ingress and application access logs.

### Secrets

Store the following using the GitOps repository's established secret mechanism rather than plaintext manifests:

- Superset `SECRET_KEY`;
- metadata database credentials;
- Redis credentials when authentication is enabled;
- Loan Matrix JWT signing private key;
- Superset JWT verification public key;
- read-only Goodfellow reporting database credentials.

## Data Access

Only Goodfellow reporting data sources are configured initially. Viewer users can open approved dashboards and charts but cannot alter datasets, database connections, roles, or security configuration.

The `mifos` creator account can create and edit dashboards and charts against approved datasets. SQL Lab and database connection management remain disabled unless separately approved later.

## Error Handling

- Missing or disabled tenant configuration: hide the UI action and return `404` from the launch route.
- Invalid Superset URL or incomplete configuration: hide the action, emit a structured server log, and return `503` if the route is called directly.
- Missing authentication: return `401`.
- Missing Reports access: return `403`.
- Expired or invalid assertion: show a friendly Superset page instructing the user to return to Loan Matrix and launch Advanced Analytics again.
- Replayed assertion: deny access and log the replay without recording the token.
- Superset unavailable: display a clear availability error without falling back to a separate login.

## Session Behavior

Superset establishes its own short-lived application session after the SSO handoff. Loan Matrix logout does not automatically invalidate an already-issued Superset session in this initial design. Superset sessions should use a conservative timeout, initially 30 minutes of inactivity, and users can explicitly log out of Superset.

Full single logout is deferred because it would require a broader shared identity-provider design.

## Testing

### Loan Matrix

- Tenant configuration parsing and HTTPS URL validation.
- Goodfellow enabled versus other tenants disabled.
- Reports access enforced by both UI and launch route.
- Default viewer mapping.
- Case-insensitive `mifos` creator mapping.
- JWT claims, audience, expiry, and unique `jti`.
- No secret or token leakage in logs.

### Superset Extension

- Valid assertion provisions and signs in a viewer.
- `mifos` provisions and signs in with creator permissions.
- Invalid signature, issuer, audience, tenant, and expiry are rejected.
- Replayed `jti` is rejected.
- Existing user roles are reconciled to the current tenant configuration.

### GitOps and Integration

- Helm rendering and Kubernetes manifest validation.
- Metadata migration/bootstrap completes before readiness.
- TLS and routing smoke tests.
- Goodfellow Reports user sees the link and can view approved analytics.
- `mifos` can create/edit charts and dashboards but cannot administer Superset.
- A non-Goodfellow tenant does not see the link and cannot use the SSO route.
- Read-only data-source credentials cannot modify reporting databases.

## Rollout and Rollback

1. Deploy Superset with no Loan Matrix tenant enabled and verify health, TLS, metadata migrations, and the SSO rejection path.
2. Configure approved Goodfellow read-only data sources and dashboards.
3. Add the Goodfellow `superset` tenant settings block in the database.
4. Smoke-test a viewer account and the `mifos` creator account.
5. Monitor authentication failures, pod health, database connections, and resource use.

Rollback is immediate by setting `settings.superset.enabled` to `false`. This removes the Loan Matrix entry point and blocks new SSO launches without affecting existing Loan Matrix reporting. The Superset GitOps application can then be scaled down or removed independently if required.
