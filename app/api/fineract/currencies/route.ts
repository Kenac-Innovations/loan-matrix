import { NextResponse } from "next/server";
import {
  fetchFineractAPI,
  fetchFineractAPIAsCurrentUser,
  isFineractCommandPendingApproval,
} from "@/lib/api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { currencyUpdateInputSchema, validationErrorMessage } from "@/lib/organization-form-schemas";
import { invalidateOrgCurrencyCache } from "@/lib/currency-utils";

/**
 * GET /api/fineract/currencies
 * Fetch all currencies from Fineract
 */
export async function GET() {
  try {
    const data = await fetchFineractAPI("/currencies");
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching currencies:", error);
    return buildFineractErrorResponse(error);
  }
}

/**
 * PUT /api/fineract/currencies
 * Update enabled currencies for the organization
 */
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = currencyUpdateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: validationErrorMessage(parsed.error), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await fetchFineractAPIAsCurrentUser("/currencies", {
      method: "PUT",
      body: JSON.stringify({ currencies: parsed.data.currencies }),
    });
    if (isFineractCommandPendingApproval(data)) {
      return NextResponse.json({ pendingApproval: true });
    }
    await invalidateOrgCurrencyCache();
    return NextResponse.json(data);
  } catch (error) {
    return buildFineractErrorResponse(error, { action: "update", resource: "currencies" });
  }
}
