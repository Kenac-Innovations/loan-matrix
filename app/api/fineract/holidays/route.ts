import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchFineractAPI } from "@/lib/api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import {
  holidayCreateInputSchema,
  toFineractHolidayCreatePayload,
  validationErrorMessage,
} from "@/lib/organization-form-schemas";

const officeIdSchema = z.coerce.number().int().positive();

export async function GET(request: Request) {
  const officeId = new URL(request.url).searchParams.get("officeId");
  const parsedOfficeId = officeIdSchema.safeParse(officeId);
  if (!parsedOfficeId.success) {
    return NextResponse.json({ error: "A valid office is required." }, { status: 400 });
  }

  try {
    const data = await fetchFineractAPI(`/holidays?officeId=${parsedOfficeId.data}`, {
      authMode: "service",
      cache: "no-store",
    });
    return NextResponse.json(data);
  } catch (error) {
    return buildFineractErrorResponse(error, { action: "load", resource: "holidays" });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = holidayCreateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: validationErrorMessage(parsed.error), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await fetchFineractAPI("/holidays", {
      method: "POST",
      body: JSON.stringify(toFineractHolidayCreatePayload(parsed.data)),
    });
    return NextResponse.json(data);
  } catch (error) {
    return buildFineractErrorResponse(error, { action: "create", resource: "holiday" });
  }
}
