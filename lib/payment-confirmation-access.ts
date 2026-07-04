import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

type PaymentConfirmationAccessContext = {
  ok: true;
  tenant: NonNullable<Awaited<ReturnType<typeof getTenantFromHeaders>>>;
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  actorId: string;
  actorName: string;
};

type PaymentConfirmationAccessDenied = {
  ok: false;
  status: number;
  message: string;
};

export type PaymentConfirmationPageAccess =
  | PaymentConfirmationAccessContext
  | PaymentConfirmationAccessDenied;

type PaymentConfirmationRouteAccess =
  | PaymentConfirmationAccessContext
  | {
      ok: false;
      response: NextResponse;
    };

async function getPaymentConfirmationAccess(): Promise<PaymentConfirmationPageAccess> {
  const [tenant, session] = await Promise.all([
    getTenantFromHeaders(),
    getSession(),
  ]);

  if (!session?.user?.userId) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized",
    };
  }

  if (!tenant) {
    return {
      ok: false,
      status: 404,
      message: "Tenant not found",
    };
  }

  const permittedLogin = await prisma.userLogin.findFirst({
    where: {
      tenantId: tenant.id,
      fineractUserId: session.user.userId,
      canConfirmPayments: true,
    },
    select: {
      id: true,
    },
  });

  if (!permittedLogin) {
    return {
      ok: false,
      status: 403,
      message: "Payment confirmation access is not enabled for your user.",
    };
  }

  return {
    ok: true,
    tenant,
    session,
    actorId: String(session.user.userId),
    actorName: session.user.name || session.user.email || "system",
  };
}

export async function requirePaymentConfirmationPageAccess(): Promise<PaymentConfirmationPageAccess> {
  return getPaymentConfirmationAccess();
}

export async function requirePaymentConfirmationAccess(): Promise<PaymentConfirmationRouteAccess> {
  const access = await getPaymentConfirmationAccess();

  if (!access.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: access.message },
        { status: access.status }
      ),
    };
  }

  return access;
}
