import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * Helper to get code ID by name
 */
async function getCodeIdByName(codeName: string): Promise<number | null> {
  const codesResponse = await fetchFineractAPI("/codes");
  const codes = Array.isArray(codesResponse)
    ? codesResponse
    : codesResponse?.data || codesResponse || [];

  const code = codes.find(
    (c: any) => c.name?.toLowerCase() === codeName.toLowerCase()
  );

  return code?.id || null;
}

/**
 * GET /api/fineract/codes/[codeName]/codevalues/[valueId]
 * Fetches a specific code value
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ codeName: string; valueId: string }> }
) {
  try {
    const { codeName, valueId } = await params;

    const codeId = await getCodeIdByName(codeName);
    if (!codeId) {
      return NextResponse.json(
        { error: `Code '${codeName}' not found` },
        { status: 404 }
      );
    }

    const data = await fetchFineractAPI(`/codes/${codeId}/codevalues/${valueId}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error fetching code value:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch code value" },
      { status: error.status || 500 }
    );
  }
}

/**
 * PUT /api/fineract/codes/[codeName]/codevalues/[valueId]
 * Updates a specific code value
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ codeName: string; valueId: string }> }
) {
  try {
    const { codeName, valueId } = await params;
    const body = await request.json();
    const { name, description, position, isActive } = body;

    const codeId = await getCodeIdByName(codeName);
    if (!codeId) {
      return NextResponse.json(
        { error: `Code '${codeName}' not found` },
        { status: 404 }
      );
    }

    const payload: any = {};
    if (name !== undefined) payload.name = name;
    if (description !== undefined) payload.description = description;
    if (position !== undefined) payload.position = position;
    if (isActive !== undefined) payload.isActive = isActive;

    const data = await fetchFineractAPI(`/codes/${codeId}/codevalues/${valueId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error updating code value:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to update code value" },
      { status: error.status || 500 }
    );
  }
}

/**
 * DELETE /api/fineract/codes/[codeName]/codevalues/[valueId]
 * Deletes a specific code value
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ codeName: string; valueId: string }> }
) {
  try {
    const { codeName, valueId } = await params;

    const codeId = await getCodeIdByName(codeName);
    if (!codeId) {
      return NextResponse.json(
        { error: `Code '${codeName}' not found` },
        { status: 404 }
      );
    }

    const data = await fetchFineractAPI(`/codes/${codeId}/codevalues/${valueId}`, {
      method: "DELETE",
    });

    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error(`Error deleting code value:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to delete code value" },
      { status: error.status || 500 }
    );
  }
}

