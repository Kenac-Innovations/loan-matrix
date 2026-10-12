import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchFineractAPI } from "@/lib/api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import {
  holidayUpdateInputSchema,
  toFineractHolidayUpdatePayload,
  validationErrorMessage,
} from "@/lib/organization-form-schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const holidayIdSchema = z.coerce.number().int().positive();

function invalidHolidayId() {
  return NextResponse.json({ error: "A valid holiday ID is required." }, { status: 400 });
}

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!holidayIdSchema.safeParse(id).success) return invalidHolidayId();

  try {
    const data = await fetchFineractAPI(`/holidays/${id}`, { authMode: "service" });
    return NextResponse.json(data);
  } catch (error) {
    return buildFineractErrorResponse(error, { action: "load", resource: "holiday" });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!holidayIdSchema.safeParse(id).success) return invalidHolidayId();

  const body = await request.json().catch(() => null);
  const parsed = holidayUpdateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: validationErrorMessage(parsed.error), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await fetchFineractAPI(`/holidays/${id}`, {
      method: "PUT",
      body: JSON.stringify(toFineractHolidayUpdatePayload(parsed.data)),
    });
    return NextResponse.json(data);
  } catch (error) {
    return buildFineractErrorResponse(error, { action: "update", resource: "holiday" });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!holidayIdSchema.safeParse(id).success) return invalidHolidayId();
  if (new URL(request.url).searchParams.get("command") !== "activate") {
    return NextResponse.json({ error: "Unsupported holiday command." }, { status: 400 });
  }

  try {
    const data = await fetchFineractAPI(`/holidays/${id}?command=activate`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return NextResponse.json(data);
  } catch (error) {
    return buildFineractErrorResponse(error, { action: "update", resource: "holiday" });
  }
}
