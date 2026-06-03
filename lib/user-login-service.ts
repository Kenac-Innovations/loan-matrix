import { Prisma } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  getAfricanCountryDialCodeOrDefault,
  isAfricanCountryDialCode,
  normalizePhoneDigits,
} from "@/lib/phone-utils";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import type { UserLoginBlockSource } from "@/shared/types/user-management";

export const USER_LOGIN_BLOCKED_MESSAGE =
  "Your account is blocked. Contact your system administrator for help.";

export function normalizeUserLoginValue(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function requireCurrentTenant() {
  const tenant = await getTenantFromHeaders();

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return tenant;
}

export async function getUserLoginByFineractUserId(
  tenantId: string,
  fineractUserId: number
) {
  return prisma.userLogin.findUnique({
    where: {
      tenantId_fineractUserId: {
        tenantId,
        fineractUserId,
      },
    },
  });
}

export async function getUserLoginByUsername(
  tenantId: string,
  username: string
) {
  return prisma.userLogin.findUnique({
    where: {
      tenantId_username: {
        tenantId,
        username,
      },
    },
  });
}

export function isUserLoginBlocked(userLogin: { isBlocked: boolean } | null | undefined) {
  return Boolean(userLogin?.isBlocked);
}

function getNormalizedUserLoginWriteData(input: {
  username: string;
  email?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  lastLoginAt?: Date | null;
  lastMfaChannel?: string | null;
  lastMfaSentAt?: Date | null;
}) {
  const normalizedEmail = normalizeUserLoginValue(input.email);
  const normalizedPhone = normalizePhoneDigits(input.phone);
  const normalizedCountryCode =
    normalizedPhone && isAfricanCountryDialCode(input.countryCode)
      ? getAfricanCountryDialCodeOrDefault(input.countryCode)
      : null;
  const normalizedUsername = input.username.trim();

  return {
    normalizedEmail,
    normalizedPhone,
    normalizedCountryCode,
    normalizedUsername,
  };
}

type UpsertUserLoginInput = {
  tenantId: string;
  fineractUserId: number;
  username: string;
  email?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  lastLoginAt?: Date | null;
  lastMfaChannel?: string | null;
  lastMfaSentAt?: Date | null;
};

export async function upsertUserLogin(input: UpsertUserLoginInput) {
  const {
    tenantId,
    fineractUserId,
    username,
    email,
    phone,
    countryCode,
    lastLoginAt,
    lastMfaChannel,
    lastMfaSentAt,
  } = input;
  const {
    normalizedEmail,
    normalizedPhone,
    normalizedCountryCode,
    normalizedUsername,
  } = getNormalizedUserLoginWriteData({
    username,
    email,
    phone,
    countryCode,
    lastLoginAt,
    lastMfaChannel,
    lastMfaSentAt,
  });

  const updateData: Record<string, unknown> = {
    username: normalizedUsername,
  };

  if (email !== undefined) {
    updateData.email = normalizedEmail;
  }

  if (phone !== undefined) {
    updateData.phone = normalizedPhone;
  }

  if (countryCode !== undefined || phone !== undefined) {
    updateData.countryCode = normalizedCountryCode;
  }

  if (lastLoginAt !== undefined) {
    updateData.lastLoginAt = lastLoginAt;
  }

  if (lastMfaChannel !== undefined) {
    updateData.lastMfaChannel = lastMfaChannel;
  }

  if (lastMfaSentAt !== undefined) {
    updateData.lastMfaSentAt = lastMfaSentAt;
  }

  return prisma.userLogin.upsert({
    where: {
      tenantId_fineractUserId: {
        tenantId,
        fineractUserId,
      },
    },
    update: updateData,
    create: {
      tenantId,
      fineractUserId,
      username: normalizedUsername,
      email: normalizedEmail,
      phone: normalizedPhone,
      countryCode: normalizedCountryCode,
      lastLoginAt: lastLoginAt ?? null,
      lastMfaChannel: lastMfaChannel ?? null,
      lastMfaSentAt: lastMfaSentAt ?? null,
    },
  });
}

export async function deleteUserLogin(
  tenantId: string,
  fineractUserId: number
) {
  await prisma.userLogin.deleteMany({
    where: {
      tenantId,
      fineractUserId,
    },
  });
}

export async function updateUserLoginLastLogin(input: {
  tenantId: string;
  fineractUserId: number;
  username: string;
  email?: string | null;
}) {
  return upsertUserLogin({
    ...input,
    lastLoginAt: new Date(),
  });
}

type UserLoginActor = {
  actorUserId?: number | null;
  actorName?: string | null;
};

type UserLoginBlockInput = UserLoginActor & {
  tenantId: string;
  fineractUserId: number;
  username: string;
  email?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  note: string;
  source: UserLoginBlockSource;
};

async function ensureUserLoginRecord(
  tx: Prisma.TransactionClient,
  input: Omit<UserLoginBlockInput, "note" | "source" | "actorUserId" | "actorName">
) {
  const {
    normalizedEmail,
    normalizedPhone,
    normalizedCountryCode,
    normalizedUsername,
  } = getNormalizedUserLoginWriteData(input);

  return tx.userLogin.upsert({
    where: {
      tenantId_fineractUserId: {
        tenantId: input.tenantId,
        fineractUserId: input.fineractUserId,
      },
    },
    update: {
      username: normalizedUsername,
      ...(input.email !== undefined ? { email: normalizedEmail } : {}),
      ...(input.phone !== undefined ? { phone: normalizedPhone } : {}),
      ...(input.phone !== undefined || input.countryCode !== undefined
        ? { countryCode: normalizedCountryCode }
        : {}),
    },
    create: {
      tenantId: input.tenantId,
      fineractUserId: input.fineractUserId,
      username: normalizedUsername,
      email: normalizedEmail,
      phone: normalizedPhone,
      countryCode: normalizedCountryCode,
    },
  });
}

export async function blockUserLogin(input: UserLoginBlockInput) {
  const note = input.note.trim();

  if (!note) {
    throw new Error("A note is required to block this account.");
  }

  return prisma.$transaction(async (tx) => {
    const userLogin = await ensureUserLoginRecord(tx, input);

    if (userLogin.isBlocked) {
      await tx.mfaChallenge.updateMany({
        where: {
          tenantId: input.tenantId,
          fineractUserId: input.fineractUserId,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: {
          invalidatedAt: new Date(),
        },
      });

      return {
        changed: false,
        userLogin,
      };
    }

    const now = new Date();
    const actorName = normalizeUserLoginValue(input.actorName);

    const updatedUserLogin = await tx.userLogin.update({
      where: { id: userLogin.id },
      data: {
        isBlocked: true,
        blockedAt: now,
        blockedSource: input.source,
        blockedNote: note,
        blockedByActorUserId: input.actorUserId ?? null,
        blockedByActorName: actorName,
      },
    });

    await tx.userLoginBlockEvent.create({
      data: {
        tenantId: input.tenantId,
        userLoginId: userLogin.id,
        fineractUserId: input.fineractUserId,
        username: updatedUserLogin.username,
        action: "BLOCK",
        source: input.source,
        note,
        actorUserId: input.actorUserId ?? null,
        actorName,
      },
    });

    await tx.mfaChallenge.updateMany({
      where: {
        tenantId: input.tenantId,
        fineractUserId: input.fineractUserId,
        consumedAt: null,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: now,
      },
    });

    return {
      changed: true,
      userLogin: updatedUserLogin,
    };
  });
}

export async function unblockUserLogin(input: UserLoginBlockInput) {
  const note = input.note.trim();

  if (!note) {
    throw new Error("A note is required to unblock this account.");
  }

  return prisma.$transaction(async (tx) => {
    const userLogin = await ensureUserLoginRecord(tx, input);

    if (!userLogin.isBlocked) {
      return {
        changed: false,
        userLogin,
      };
    }

    const actorName = normalizeUserLoginValue(input.actorName);
    const updatedUserLogin = await tx.userLogin.update({
      where: { id: userLogin.id },
      data: {
        isBlocked: false,
        blockedAt: null,
        blockedSource: null,
        blockedNote: null,
        blockedByActorUserId: null,
        blockedByActorName: null,
      },
    });

    await tx.userLoginBlockEvent.create({
      data: {
        tenantId: input.tenantId,
        userLoginId: userLogin.id,
        fineractUserId: input.fineractUserId,
        username: updatedUserLogin.username,
        action: "UNBLOCK",
        source: input.source,
        note,
        actorUserId: input.actorUserId ?? null,
        actorName,
      },
    });

    return {
      changed: true,
      userLogin: updatedUserLogin,
    };
  });
}
