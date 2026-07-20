import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

export class UssdPinResetAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UssdPinResetAccessError";
    this.status = status;
  }
}

type SessionLike = Awaited<ReturnType<typeof getSession>>;

export const USSD_PIN_RESET_NOT_ENABLED_MESSAGE =
  "USSD PIN reset is not enabled for this tenant. Contact your administrator to configure the USSD service tenant.";

function isSuperAdminSession(session: SessionLike): boolean {
  if (!session?.user) {
    return false;
  }

  if (session.user.name === "mifos") {
    return true;
  }

  return (
    session.user.roles?.some(
      (role) => role.name === "SUPER_ADMIN" && !role.disabled
    ) ?? false
  );
}

export async function canResetUssdPinServer(): Promise<boolean> {
  const [tenant, session] = await Promise.all([
    getTenantFromHeaders(),
    getSession(),
  ]);

  if (!tenant || !session?.user?.userId) {
    return false;
  }

  if (isSuperAdminSession(session)) {
    return true;
  }

  const userLogin = await prisma.userLogin.findUnique({
    where: {
      tenantId_fineractUserId: {
        tenantId: tenant.id,
        fineractUserId: session.user.userId,
      },
    },
    select: {
      canResetUssdPin: true,
    },
  });

  return Boolean(userLogin?.canResetUssdPin);
}

export async function requireUssdPinResetAccess() {
  const [tenant, session] = await Promise.all([
    getTenantFromHeaders(),
    getSession(),
  ]);

  if (!tenant) {
    throw new UssdPinResetAccessError("Tenant not found", 404);
  }

  if (!session?.user?.userId || !session.user.name) {
    throw new UssdPinResetAccessError("Authentication required", 401);
  }

  if (isSuperAdminSession(session)) {
    return {
      tenant,
      actorUserId: session.user.userId,
      actorName: session.user.name,
    };
  }

  const userLogin = await prisma.userLogin.findUnique({
    where: {
      tenantId_fineractUserId: {
        tenantId: tenant.id,
        fineractUserId: session.user.userId,
      },
    },
    select: {
      canResetUssdPin: true,
    },
  });

  if (!userLogin?.canResetUssdPin) {
    throw new UssdPinResetAccessError(
      "You do not have permission to reset USSD PINs",
      403
    );
  }

  return {
    tenant,
    actorUserId: session.user.userId,
    actorName: session.user.name,
  };
}

export function requireUssdServiceTenantId(tenant: {
  ussdServiceTenantId?: string | null;
}): string {
  const ussdServiceTenantId = tenant.ussdServiceTenantId?.trim();

  if (!ussdServiceTenantId) {
    throw new UssdPinResetAccessError(
      USSD_PIN_RESET_NOT_ENABLED_MESSAGE,
      403
    );
  }

  return ussdServiceTenantId;
}
