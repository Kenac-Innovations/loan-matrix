"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function resolveUserId(): Promise<number> {
  const session = await getSession();
  const userId = session?.user?.userId as number | undefined;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export async function getMySignature(): Promise<{ signatureData: string | null }> {
  const fineractUserId = await resolveUserId();
  const record = await prisma.userSignature.findUnique({
    where: { fineractUserId },
    select: { signatureData: true },
  });
  return { signatureData: record?.signatureData ?? null };
}

export async function saveMySignature(
  signatureData: string
): Promise<{ success: boolean; error?: string }> {
  if (!signatureData || !signatureData.startsWith("data:image/")) {
    return { success: false, error: "Invalid image data" };
  }
  const fineractUserId = await resolveUserId();
  await prisma.userSignature.upsert({
    where: { fineractUserId },
    create: { fineractUserId, signatureData },
    update: { signatureData },
  });
  return { success: true };
}

export async function deleteMySignature(): Promise<{ success: boolean }> {
  const fineractUserId = await resolveUserId();
  await prisma.userSignature.deleteMany({ where: { fineractUserId } });
  return { success: true };
}
