"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermissionServer } from "@/lib/authorization";
import {
  getUserSignatureCreateData,
  getUserSignatureDeleteWhere,
  getUserSignatureUniqueWhere,
} from "@/lib/user-signature-scope";
import { requireCurrentTenant } from "@/lib/user-login-service";
import { SpecificPermission } from "@/shared/types/auth";

const maxSignatureSizeBytes = 2 * 1024 * 1024;
const allowedSignaturePrefixes = [
  "data:image/jpeg;base64,",
  "data:image/jpg;base64,",
  "data:image/png;base64,",
  "data:image/gif;base64,",
];

const managedUserSignatureSchema = z.object({
  userId: z.coerce.number().int().positive("User id is required"),
});

function getSignaturePayloadSize(signatureData: string) {
  const separatorIndex = signatureData.indexOf(",");
  if (separatorIndex === -1) {
    return Number.POSITIVE_INFINITY;
  }

  const encodedPayload = signatureData.slice(separatorIndex + 1);
  const paddingLength = (encodedPayload.match(/=*$/)?.[0].length ?? 0);

  return Math.floor((encodedPayload.length * 3) / 4) - paddingLength;
}

function validateSignatureData(signatureData: string) {
  if (
    !signatureData ||
    !allowedSignaturePrefixes.some((prefix) => signatureData.startsWith(prefix))
  ) {
    return "Please upload a JPG, PNG, or GIF image";
  }

  if (getSignaturePayloadSize(signatureData) > maxSignatureSizeBytes) {
    return "Please upload an image smaller than 2MB";
  }

  return null;
}

async function ensureAnyPermission(
  permissions: SpecificPermission[],
  message = "You do not have permission to perform this action"
) {
  for (const permission of permissions) {
    if (await hasPermissionServer(permission)) {
      return;
    }
  }

  throw new Error(message);
}

function revalidateSignaturePaths(userId: number) {
  revalidatePath(`/organization/users/${userId}`);
  revalidatePath(`/organization/users/${userId}/edit`);
}

async function resolveUserId(): Promise<number> {
  const session = await getSession();
  const userId = session?.user?.userId as number | undefined;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export async function getMySignature(): Promise<{ signatureData: string | null }> {
  const [fineractUserId, tenant] = await Promise.all([
    resolveUserId(),
    requireCurrentTenant(),
  ]);
  const record = await prisma.userSignature.findUnique({
    where: getUserSignatureUniqueWhere(tenant.id, fineractUserId),
    select: { signatureData: true },
  });
  return { signatureData: record?.signatureData ?? null };
}

export async function saveMySignature(
  signatureData: string
): Promise<{ success: boolean; error?: string }> {
  const validationError = validateSignatureData(signatureData);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const [fineractUserId, tenant] = await Promise.all([
    resolveUserId(),
    requireCurrentTenant(),
  ]);
  await prisma.userSignature.upsert({
    where: getUserSignatureUniqueWhere(tenant.id, fineractUserId),
    create: getUserSignatureCreateData(tenant.id, fineractUserId, signatureData),
    update: { signatureData },
  });
  return { success: true };
}

export async function deleteMySignature(): Promise<{ success: boolean }> {
  const [fineractUserId, tenant] = await Promise.all([
    resolveUserId(),
    requireCurrentTenant(),
  ]);
  await prisma.userSignature.deleteMany({
    where: getUserSignatureDeleteWhere(tenant.id, fineractUserId),
  });
  return { success: true };
}

export async function getUserSignatureAction(
  userId: number | string
): Promise<{ signatureData: string | null }> {
  await ensureAnyPermission(
    [SpecificPermission.READ_USER, SpecificPermission.UPDATE_USER],
    "You do not have permission to view user signatures"
  );

  const parsed = managedUserSignatureSchema.parse({ userId });
  const tenant = await requireCurrentTenant();
  const record = await prisma.userSignature.findUnique({
    where: getUserSignatureUniqueWhere(tenant.id, parsed.userId),
    select: { signatureData: true },
  });

  return { signatureData: record?.signatureData ?? null };
}

export async function saveUserSignatureAction(input: {
  userId: number | string;
  signatureData: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureAnyPermission(
      [SpecificPermission.CREATE_USER, SpecificPermission.UPDATE_USER],
      "You do not have permission to manage user signatures"
    );

    const parsed = managedUserSignatureSchema.parse(input);
    const tenant = await requireCurrentTenant();
    const validationError = validateSignatureData(input.signatureData);

    if (validationError) {
      return { success: false, error: validationError };
    }

    await prisma.userSignature.upsert({
      where: getUserSignatureUniqueWhere(tenant.id, parsed.userId),
      create: getUserSignatureCreateData(
        tenant.id,
        parsed.userId,
        input.signatureData
      ),
      update: {
        signatureData: input.signatureData,
      },
    });

    revalidateSignaturePaths(parsed.userId);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save user signature",
    };
  }
}

export async function deleteUserSignatureAction(input: {
  userId: number | string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureAnyPermission(
      [SpecificPermission.CREATE_USER, SpecificPermission.UPDATE_USER],
      "You do not have permission to manage user signatures"
    );

    const parsed = managedUserSignatureSchema.parse(input);
    const tenant = await requireCurrentTenant();

    await prisma.userSignature.deleteMany({
      where: getUserSignatureDeleteWhere(tenant.id, parsed.userId),
    });

    revalidateSignaturePaths(parsed.userId);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to remove user signature",
    };
  }
}
