import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchFineractAPI } from "@/lib/api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import {
  officeUpdateInputSchema,
  toFineractOfficeUpdatePayload,
  validationErrorMessage,
} from "@/lib/organization-form-schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const officeIdSchema = z.coerce.number().int().positive();

function invalidOfficeId() {
  return NextResponse.json({ error: "A valid office ID is required." }, { status: 400 });
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!officeIdSchema.safeParse(id).success) return invalidOfficeId();

  try {
    const template = new URL(request.url).searchParams.get("template") === "true";
    const data = await fetchFineractAPI(
      `/offices/${id}${template ? "?template=true" : ""}`,
      { authMode: "service" },
    );
    return NextResponse.json(data);
  } catch (error) {
    return buildFineractErrorResponse(error, { action: "load", resource: "office" });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!officeIdSchema.safeParse(id).success) return invalidOfficeId();

  const body = await request.json().catch(() => null);
  const parsed = officeUpdateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: validationErrorMessage(parsed.error), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const data = await fetchFineractAPI(`/offices/${id}`, {
      method: "PUT",
      body: JSON.stringify(toFineractOfficeUpdatePayload(parsed.data)),
    });
    return NextResponse.json(data);
  } catch (error) {
    return buildFineractErrorResponse(error, { action: "update", resource: "office" });
  }
}
