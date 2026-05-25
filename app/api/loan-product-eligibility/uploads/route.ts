export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { performEligibilitySync } from "@/lib/loan-eligibility-sync";

const itemSchema = z.object({
  rowNumber: z.number().int().positive(),
  name: z.string().trim().min(1),
  nrc: z.string().trim().min(1),
  phone: z.string().trim().min(1),
});

const createUploadSchema = z.object({
  fileName: z.string().trim().min(1),
  productExternalId: z.string().trim().min(1),
  productName: z.string().trim().min(1),
  items: z.array(itemSchema).min(1),
});

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function normalizePhoneNumber(input: string): string {
  const digits = (input || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("260")) return digits;
  if (digits.length === 9) return `260${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `260${digits.slice(1)}`;
  return digits;
}

export async function GET() {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const uploads = await prisma.loanEligibilityUpload.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(uploads);
  } catch (error: unknown) {
    console.error("Error fetching loan eligibility uploads:", error);

    // If local DB hasn't applied this migration yet, treat as empty history instead of hard-failing UI.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      return NextResponse.json([]);
    }

    return NextResponse.json({ error: "Failed to fetch uploads" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = createUploadSchema.parse(await request.json());

    const duplicateMap = new Map<string, number[]>();
    const normalizedRows = payload.items.map((row) => {
      const normalizedPhone = normalizePhoneNumber(row.phone);
      if (!normalizedPhone) {
        throw new Error(`Invalid phone number at row ${row.rowNumber}`);
      }
      const current = duplicateMap.get(normalizedPhone) || [];
      current.push(row.rowNumber);
      duplicateMap.set(normalizedPhone, current);
      return {
        ...row,
        normalizedPhone,
      };
    });

    const duplicates = Array.from(duplicateMap.entries()).filter(([, rows]) => rows.length > 1);
    if (duplicates.length > 0) {
      const detail = duplicates
        .map(([phone, rows]) => `${phone} (rows: ${rows.join(", ")})`)
        .join("; ");
      return NextResponse.json(
        { error: `Duplicate phone numbers found: ${detail}` },
        { status: 400 }
      );
    }

    const uploadedBy =
      session.user.name ||
      session.user.email ||
      String(session.user.userId ?? session.user.id ?? "unknown");

    const upload = await prisma.loanEligibilityUpload.create({
      data: {
        tenantId: tenant.id,
        fileName: payload.fileName,
        productExternalId: payload.productExternalId,
        productName: payload.productName,
        uploadedBy,
        status: "STAGING",
        totalRows: normalizedRows.length,
        items: {
          create: normalizedRows.map((row) => ({
            rowNumber: row.rowNumber,
            name: row.name,
            nrc: row.nrc,
            phone: row.phone,
            normalizedPhone: row.normalizedPhone,
            status: "PENDING",
          })),
        },
      },
    });

    // Fire background sync — don't await so the response returns immediately
    void performEligibilitySync(upload.id).catch((e: unknown) => {
      console.error("Background eligibility sync failed for upload", upload.id, e);
    });

    return NextResponse.json({ id: upload.id, totalRows: upload.totalRows }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating loan eligibility upload:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: getErrorMessage(error, "Failed to create upload") }, { status: 500 });
  }
}
