export type InventoryTenant = { id: string; slug: string; settings: unknown };
export type InventoryAccessContext = { tenantId: string; tenantSlug: string; actorUserId: string; allowedOfficeIds: number[] };
export class InventoryAccessError extends Error { constructor(message: string, public status = 403) { super(message); } }
export function isArdaInventoryFeatureEnabled(tenant: InventoryTenant, feature: 'hasInventoryReports' | 'enforceStockAvailability'): boolean {
  const settings = tenant.settings as { features?: Record<string, unknown> } | null;
  return tenant.slug === 'arda' && settings?.features?.[feature] === true;
}
export function validateInventoryAccess(tenant: InventoryTenant, user: { id?: string; tenantId?: string }, offices: number[]): InventoryAccessContext {
  if (!user.id) throw new InventoryAccessError('Sign in to access inventory.', 401);
  if (!user.tenantId || user.tenantId !== tenant.id) throw new InventoryAccessError('Your session does not match this tenant.');
  if (!isArdaInventoryFeatureEnabled(tenant, 'hasInventoryReports')) throw new InventoryAccessError('Inventory reports are not enabled for this tenant.', 404);
  return { tenantId: tenant.id, tenantSlug: tenant.slug, actorUserId: user.id, allowedOfficeIds: [...new Set(offices)] };
}
export async function requireInventoryReportAccess(): Promise<InventoryAccessContext> {
  const [{ getSession }, { getTenantFromHeaders }, { getLeadViewerAccessContext }, { fetchFineractAPI }] = await Promise.all([
    import('../auth'), import('../tenant-service'), import('../lead-policy'), import('../api'),
  ]);
  const [session, tenant] = await Promise.all([getSession(), getTenantFromHeaders()]);
  if (!tenant || !session?.user?.id) throw new InventoryAccessError('Sign in to access inventory.', 401);
  validateInventoryAccess(tenant, session.user, []);
  // Session-authenticated offices constrain the service-side branch policy.
  const [offices, policy] = await Promise.all([
    fetchFineractAPI('/offices', { authMode: 'session' }),
    getLeadViewerAccessContext(tenant.id, session.user.userId),
  ]);
  const ids = (offices as { id: number }[]).map(o => o.id).filter(id => policy.visibleOfficeIds === null || policy.visibleOfficeIds.includes(id));
  return validateInventoryAccess(tenant, session.user, ids);
}
