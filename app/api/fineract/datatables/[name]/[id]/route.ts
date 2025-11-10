import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

// GET /api/fineract/datatables/[name]/[id]?genericResultSet=true
export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name, id } = await params;
    const { searchParams } = new URL(request.url);
    const genericResultSet = searchParams.get("genericResultSet") || "true";
    const query = new URLSearchParams({ genericResultSet });
    const data = await fetchFineractAPI(
      `/datatables/${encodeURIComponent(name)}/${encodeURIComponent(
        id
      )}?${query.toString()}`
    );
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch datatable data" },
      { status: error?.status || 500 }
    );
  }
}

// PUT /api/fineract/datatables/[name]/[id]
// Updates a datatable entry for a client
// Body should contain: { rowId?: number, data: { fieldName: value, ... } }
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name, id } = await params;
    const body = await request.json();
    const {
      rowId,
      data: updateData,
      dateFormat = "yyyy-MM-dd",
      locale = "en",
    } = body;

    // Validate that rowId is provided - required to avoid "multiple update" error
    if (!rowId) {
      return NextResponse.json(
        {
          error:
            "rowId is required to update a specific datatable row. Updating all rows is not allowed.",
          details: {
            message:
              "Fineract requires a specific rowId to update individual datatable entries.",
          },
        },
        { status: 400 }
      );
    }

    console.log(`Updating datatable ${name} for entity ${id}, rowId: ${rowId}`);

    // Prepare the payload for Fineract
    const payload = {
      ...updateData,
      dateFormat,
      locale,
    };

    // Always use the specific row endpoint when rowId is provided
    const endpoint = `/datatables/${encodeURIComponent(
      name
    )}/${encodeURIComponent(id)}/${rowId}`;

    console.log(`PUT endpoint: ${endpoint}`);
    console.log(`Payload:`, JSON.stringify(payload, null, 2));

    const result = await fetchFineractAPI(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error updating datatable:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          error?.errorData?.defaultUserMessage ||
          "Failed to update datatable entry",
        details: error?.errorData || null,
      },
      { status: error?.status || 500 }
    );
  }
}

// POST /api/fineract/datatables/[name]/[id]
// Creates a new datatable entry for a client
// Body should contain: { data: { fieldName: value, ... } }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  try {
    const { name, id } = await params;
    const body = await request.json();
    const { data: createData, dateFormat = "yyyy-MM-dd", locale = "en" } = body;

    console.log(`Creating datatable entry ${name} for entity ${id}`);

    // Prepare the payload for Fineract
    const payload = {
      ...createData,
      dateFormat,
      locale,
    };

    const endpoint = `/datatables/${encodeURIComponent(
      name
    )}/${encodeURIComponent(id)}`;

    console.log(`POST endpoint: ${endpoint}`);
    console.log(`Payload:`, JSON.stringify(payload, null, 2));

    const result = await fetchFineractAPI(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating datatable entry:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          error?.errorData?.defaultUserMessage ||
          "Failed to create datatable entry",
        details: error?.errorData || null,
      },
      { status: error?.status || 500 }
    );
  }
}
