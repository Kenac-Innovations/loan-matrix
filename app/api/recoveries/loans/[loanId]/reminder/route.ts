import { NextRequest, NextResponse } from "next/server";
import { sendRecoveryReminder } from "@/lib/fineract-recoveries";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { getActorName, parseLoanId } from "@/app/api/recoveries/_utils";

function normalizeReminderBucket(value: unknown): "30" | "60" | "90" | undefined {
  if (value === "30" || value === "60" || value === "90") return value;
  return undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ loanId: string }> }
) {
  try {
    const { loanId: rawLoanId } = await params;
    const loanId = parseLoanId(rawLoanId);
    if (!loanId) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await sendRecoveryReminder({
      loanId,
      bucket: normalizeReminderBucket(body.bucket),
      tenantSlug: extractTenantSlugFromRequest(request),
      actorName: await getActorName(),
      note: typeof body.note === "string" ? body.note : undefined,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (error) {
    console.error("Error sending recovery reminder:", error);
    return NextResponse.json(
      {
        error: "Failed to send recovery reminder",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
