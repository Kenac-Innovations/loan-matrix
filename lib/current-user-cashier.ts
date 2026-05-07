import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";

export interface CurrentUserCashierContext {
  isCashier: boolean;
  hasActiveSession: boolean;
  staffId: number | null;
  staffName: string | null;
  cashierId: string | null;
  fineractCashierId: number | null;
  tellerId: string | null;
  fineractTellerId: number | null;
  tellerName: string | null;
  tellerOfficeName: string | null;
  reason?: string;
}

function parseFineractDate(dateInput: unknown): Date {
  if (Array.isArray(dateInput) && dateInput.length >= 3) {
    return new Date(Number(dateInput[0]), Number(dateInput[1]) - 1, Number(dateInput[2]));
  }
  if (typeof dateInput === "string" || typeof dateInput === "number") {
    return new Date(dateInput);
  }
  return new Date();
}

async function buildContextFromCashier(
  tenantId: string,
  cashier: {
    id: string;
    staffId: number;
    staffName: string;
    fineractCashierId: number | null;
    teller: {
      id: string;
      name: string;
      officeName: string;
      fineractTellerId: number | null;
    };
  }
): Promise<CurrentUserCashierContext> {
  const activeSession = await prisma.cashierSession.findFirst({
    where: {
      tenantId,
      tellerId: cashier.teller.id,
      cashierId: cashier.id,
      sessionStatus: "ACTIVE",
    },
    select: { id: true },
  });

  return {
    isCashier: true,
    hasActiveSession: Boolean(activeSession),
    staffId: cashier.staffId,
    staffName: cashier.staffName,
    cashierId: cashier.id,
    fineractCashierId: cashier.fineractCashierId ?? null,
    tellerId: cashier.teller.id,
    fineractTellerId: cashier.teller.fineractTellerId ?? null,
    tellerName: cashier.teller.name,
    tellerOfficeName: cashier.teller.officeName,
    reason: activeSession ? undefined : "Cashier does not have an active session",
  };
}

async function syncCashierFromFineract(
  tenantId: string,
  staffId: number,
  staffName: string
) {
  const fineract = await getFineractServiceWithSession();
  const tellers = await prisma.teller.findMany({
    where: {
      tenantId,
      isActive: true,
      fineractTellerId: { not: null },
    },
    orderBy: { updatedAt: "desc" },
  });

  for (const teller of tellers) {
    if (!teller.fineractTellerId) continue;

    let fineractCashiers: Array<{
      id: number;
      staffId?: number;
      staffName?: string;
      startDate?: unknown;
      endDate?: unknown;
      isFullDay?: boolean;
      isRunning?: boolean;
    }> = [];
    try {
      fineractCashiers = await fineract.getCashiers(teller.fineractTellerId);
    } catch (error) {
      console.error("[CashierContext] Failed to fetch teller cashiers:", {
        tellerId: teller.id,
        fineractTellerId: teller.fineractTellerId,
        error,
      });
      continue;
    }

    const matchingCashier = fineractCashiers.find(
      (cashier) => Number(cashier?.staffId) === Number(staffId)
    );

    if (!matchingCashier) continue;

    const syncedCashier = await prisma.cashier.upsert({
      where: {
        tenantId_fineractCashierId: {
          tenantId,
          fineractCashierId: matchingCashier.id,
        },
      },
      create: {
        tenantId,
        tellerId: teller.id,
        fineractCashierId: matchingCashier.id,
        staffId,
        staffName: matchingCashier.staffName || staffName,
        startDate: parseFineractDate(matchingCashier.startDate),
        endDate: matchingCashier.endDate
          ? parseFineractDate(matchingCashier.endDate)
          : null,
        isFullDay:
          matchingCashier.isFullDay !== undefined
            ? Boolean(matchingCashier.isFullDay)
            : true,
        status: "ACTIVE",
        isActive: true,
      },
      update: {
        tellerId: teller.id,
        staffId,
        staffName: matchingCashier.staffName || staffName,
        startDate: parseFineractDate(matchingCashier.startDate),
        endDate: matchingCashier.endDate
          ? parseFineractDate(matchingCashier.endDate)
          : null,
        isFullDay:
          matchingCashier.isFullDay !== undefined
            ? Boolean(matchingCashier.isFullDay)
            : true,
        status: "ACTIVE",
        isActive: true,
      },
      include: {
        teller: {
          select: {
            id: true,
            name: true,
            officeName: true,
            fineractTellerId: true,
          },
        },
      },
    });

    if (matchingCashier.isRunning) {
      const existingSession = await prisma.cashierSession.findFirst({
        where: {
          tenantId,
          tellerId: teller.id,
          cashierId: syncedCashier.id,
          sessionStatus: "ACTIVE",
        },
        select: { id: true },
      });

      if (!existingSession) {
        await prisma.cashierSession.create({
          data: {
            tenantId,
            tellerId: teller.id,
            cashierId: syncedCashier.id,
            fineractSessionId: matchingCashier.id || null,
            sessionStatus: "ACTIVE",
            sessionStartTime: new Date(),
            allocatedBalance: 0,
            availableBalance: 0,
            openingFloat: 0,
            cashIn: 0,
            cashOut: 0,
            netCash: 0,
          },
        });
      }
    }

    return syncedCashier;
  }

  return null;
}

export async function resolveCurrentUserCashierContext(
  tenantId: string,
  mifosUserId: string | number | null | undefined
): Promise<CurrentUserCashierContext> {
  const numericUserId = Number(mifosUserId);
  if (!mifosUserId || Number.isNaN(numericUserId)) {
    return {
      isCashier: false,
      hasActiveSession: false,
      staffId: null,
      staffName: null,
      cashierId: null,
      fineractCashierId: null,
      tellerId: null,
      fineractTellerId: null,
      tellerName: null,
      tellerOfficeName: null,
      reason: "Logged in user is missing a Fineract user id",
    };
  }

  const fineract = await getFineractServiceWithSession();
  const staff = await fineract.getStaffByUserId(numericUserId);
  if (!staff?.id) {
    return {
      isCashier: false,
      hasActiveSession: false,
      staffId: null,
      staffName: null,
      cashierId: null,
      fineractCashierId: null,
      tellerId: null,
      fineractTellerId: null,
      tellerName: null,
      tellerOfficeName: null,
      reason: "Logged in user is not linked to a staff record",
    };
  }

  const dbCashiers = await prisma.cashier.findMany({
    where: {
      tenantId,
      staffId: Number(staff.id),
      isActive: true,
    },
    include: {
      teller: {
        select: {
          id: true,
          name: true,
          officeName: true,
          fineractTellerId: true,
        },
      },
      sessions: {
        where: {
          tenantId,
          sessionStatus: "ACTIVE",
        },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const prioritizedCashier =
    dbCashiers.find((cashier) => cashier.sessions.length > 0) ?? dbCashiers[0];
  if (prioritizedCashier) {
    return buildContextFromCashier(tenantId, prioritizedCashier);
  }

  const syncedCashier = await syncCashierFromFineract(
    tenantId,
    Number(staff.id),
    staff.displayName || staff.firstname || staff.lastname || `Staff ${staff.id}`
  );

  if (syncedCashier) {
    return buildContextFromCashier(tenantId, syncedCashier);
  }

  return {
    isCashier: false,
    hasActiveSession: false,
    staffId: Number(staff.id),
    staffName:
      staff.displayName || staff.firstname || staff.lastname || `Staff ${staff.id}`,
    cashierId: null,
    fineractCashierId: null,
    tellerId: null,
    fineractTellerId: null,
    tellerName: null,
    tellerOfficeName: null,
    reason: "Logged in user is not assigned as a cashier",
  };
}
