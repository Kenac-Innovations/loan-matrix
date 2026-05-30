import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { hasSuperAdminServer } from "@/lib/authorization";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getErrorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    const status = (error as { status: number }).status;
    if (status >= 400 && status < 600) {
      return status;
    }
  }
  return 500;
}

function getErrorDetails(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "errorData" in error
  ) {
    return (error as { errorData?: unknown }).errorData ?? null;
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = parseInt(id);

    if (isNaN(clientId)) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const template = searchParams.get("template");
    const staffInSelectedOfficeOnly = searchParams.get(
      "staffInSelectedOfficeOnly"
    );

    const query = new URLSearchParams();
    if (template) {
      query.set("template", template);
    }
    if (staffInSelectedOfficeOnly) {
      query.set("staffInSelectedOfficeOnly", staffInSelectedOfficeOnly);
    }

    const endpoint = query.size
      ? `/clients/${clientId}?${query.toString()}`
      : `/clients/${clientId}`;

    const data = await fetchFineractAPI(endpoint);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Failed to get client:", error);
    return NextResponse.json(
      { error: "Failed to get client" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await hasSuperAdminServer())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const clientId = parseInt(id);

    if (isNaN(clientId)) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const body = await request.json();
    const data = await fetchFineractAPI(`/clients/${clientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Failed to update client:", error);
    return NextResponse.json(
      {
        error: getErrorMessage(error, "Failed to update client"),
        details: getErrorDetails(error),
      },
      { status: getErrorStatus(error) }
    );
  }
}
