import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { performEligibilitySync } from "@/lib/loan-eligibility-sync";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const upload = await prisma.loanEligibilityUpload.findFirst({
      where: { id, tenantId: tenant.id },
      select: { id: true, status: true },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    if (upload.status === "SYNCING") {
      return NextResponse.json({ error: "Sync already in progress" }, { status: 409 });
    }

    await performEligibilitySync(id);

    const updated = await prisma.loanEligibilityUpload.findUnique({
      where: { id },
      select: { status: true, syncedRows: true, failedRows: true },
    });

    return NextResponse.json({ success: true, ...updated });
  } catch (error: unknown) {
    console.error("Error triggering loan eligibility sync:", error);
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
