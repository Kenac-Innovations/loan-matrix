import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

export class UssdClientDetailsAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UssdClientDetailsAccessError";
    this.status = status;
  }
}

type SessionLike = Awaited<ReturnType<typeof getSession>>;

export const USSD_CLIENT_DETAILS_NOT_ENABLED_MESSAGE =
  "USSD Details is not enabled for this tenant. Contact your administrator to configure the USSD service tenant.";

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

export async function canUpdateUssdClientDetailsServer(): Promise<boolean> {
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
      canUpdateUssdClientDetails: true,
    },
  });

  return Boolean(userLogin?.canUpdateUssdClientDetails);
}

export async function requireUssdClientDetailsAccess() {
  const [tenant, session] = await Promise.all([
    getTenantFromHeaders(),
    getSession(),
  ]);

  if (!tenant) {
    throw new UssdClientDetailsAccessError("Tenant not found", 404);
  }

  if (!session?.user?.userId || !session.user.name) {
    throw new UssdClientDetailsAccessError("Authentication required", 401);
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
      canUpdateUssdClientDetails: true,
    },
  });

  if (!userLogin?.canUpdateUssdClientDetails) {
    throw new UssdClientDetailsAccessError(
      "You do not have permission to update USSD client details",
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
    throw new UssdClientDetailsAccessError(
      USSD_CLIENT_DETAILS_NOT_ENABLED_MESSAGE,
      403
    );
  }

  return ussdServiceTenantId;
}
