# Goodfellow Superset External Link Design

## Objective

Give Goodfellow users who can access Loan Matrix Reports a safe link to the existing Apache Superset deployment at `https://apachesupersetgoodfellow.kenac.tech/analytics/`.

This replaces the planned embedded SSO launch with a normal external link. Superset keeps its own authentication. No other Loan Matrix tenant receives the link.

## Application Behavior

- The Reports page reads the existing `Tenant.settings.superset` configuration.
- The link is available only when:
  - the current tenant is `goodfellow`;
  - Reports are enabled for the tenant;
  - `settings.superset.enabled` is `true`; and
  - `settings.superset.baseUrl` is exactly `https://apachesupersetgoodfellow.kenac.tech/analytics` after trailing-slash normalization.
- The action opens the configured URL in a new browser tab using `target="_blank"` and `rel="noopener noreferrer"`.
- The application does not create an SSO assertion and does not transmit the Loan Matrix session to Superset.
- The existing visual treatment for Advanced Analytics remains, but its copy states that Superset opens in a separate tab and may request its own login.

## Cluster Routing

- Add `apachesupersetgoodfellow.kenac.tech` to the existing public Istio Gateway server used for HTTPS traffic.
- Add a dedicated VirtualService in `superset-prod` for that exact hostname.
- Route `/analytics` and `/analytics/` to the existing Superset service without rewriting the path because Superset is already configured with `APPLICATION_ROOT=/analytics`.
- Redirect `/` to `/analytics/` so the hostname itself has a useful landing point.
- Do not change, restart, move, scale, or reconfigure the Istio control plane.
- Do not remove the existing `goodfellow.kenac.tech/analytics` route in this change. It remains available as rollback protection until the new hostname is verified.

## Deployment Safety

- All cluster changes are declarative GitOps changes; no direct production patch is permitted.
- Superset and Loan Matrix deployments retain their current replica counts and images until the relevant GitOps/application rollout step.
- The Goodfellow database flag remains disabled until the new hostname returns the Superset login page successfully.
- No other tenant settings are changed.
- Rollback consists of disabling the Goodfellow `settings.superset.enabled` flag and reverting the dedicated hostname route. The existing Reports page continues to function normally.

## Verification

1. Render and validate the Superset Helm chart locally.
2. Verify the route accepts only `apachesupersetgoodfellow.kenac.tech` and points to the existing Superset service.
3. Verify `https://apachesupersetgoodfellow.kenac.tech/` redirects to `/analytics/`.
4. Verify `/analytics/health` returns HTTP 200 and `/analytics/` reaches the Superset login/welcome flow.
5. Enable only Goodfellow's `settings.superset` configuration.
6. Verify the Reports action appears for Goodfellow, opens a new tab, and does not appear for another tenant.
7. Recheck Loan Matrix, Superset, and Argo health after rollout.
