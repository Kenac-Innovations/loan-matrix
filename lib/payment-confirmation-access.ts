import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { DEFAULT_FEATURES } from "@/shared/types/tenant";

type PaymentConfirmationAccess =
  | {
      ok: true;
      tenant: NonNullable<Awaited<ReturnType<typeof getTenantFromHeaders>>>;
      session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
      actorId: string;
      actorName: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requirePaymentConfirmationAccess(): Promise<PaymentConfirmationAccess> {
  const [tenant, session] = await Promise.all([
    getTenantFromHeaders(),
    getSession(),
  ]);

  if (!session?.user?.userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!tenant) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Tenant not found" }, { status: 404 }),
    };
  }

  const settings = tenant.settings as unknown as
    | { features?: Partial<Record<keyof typeof DEFAULT_FEATURES, boolean>> }
    | null;
  const features = {
    ...DEFAULT_FEATURES,
    ...settings?.features,
  };

  if (!features.leadConfig) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Feature disabled" }, { status: 403 }),
    };
  }

  if (session.user.name !== "mifos") {
    const superAdminRole = await prisma.userRole.findFirst({
      where: {
        tenantId: tenant.id,
        mifosUserId: session.user.userId,
        isActive: true,
        role: {
          name: "SUPER_ADMIN",
          isActive: true,
        },
      },
      select: { id: true },
    });

    if (!superAdminRole) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  return {
    ok: true,
    tenant,
    session,
    actorId: String(session.user.userId),
    actorName: session.user.name || session.user.email || "system",
  };
}
