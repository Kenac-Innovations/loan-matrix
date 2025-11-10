import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * POST /api/fineract/codes/[codeName]/codevalues
 * Creates a new code value in Fineract for the specified code name
 *
 * First fetches the code ID by name, then creates the code value using the code ID
 *
 * Request body: { name: string, description?: string, position?: number, isActive?: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ codeName: string }> }
) {
  try {
    const { codeName } = await params;
    const body = await request.json();
    const { name, description, position, isActive } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // First, fetch all codes to find the code ID by name
    const codesResponse = await fetchFineractAPI("/codes");

    // Handle both array response and wrapped response
    const codes = Array.isArray(codesResponse)
      ? codesResponse
      : codesResponse?.data || codesResponse || [];

    // Find the code that matches the codeName (case-insensitive)
    const code = codes.find(
      (c: any) => c.name?.toLowerCase() === codeName.toLowerCase()
    );

    if (!code || !code.id) {
      return NextResponse.json(
        { error: `Code '${codeName}' not found` },
        { status: 404 }
      );
    }

    const codeId = code.id;

    // Prepare the payload for Fineract code value creation
    const payload = {
      name: name,
      ...(description && { description: description }),
      position: position !== undefined ? position : 0,
      isActive: isActive !== undefined ? isActive : false,
    };

    // Create the code value in Fineract using the code ID
    const data = await fetchFineractAPI(`/codes/${codeId}/codevalues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error(`Error creating code value for ${codeName}:`, error);

    // Handle specific error cases
    if (error.status === 400) {
      return NextResponse.json(
        { error: error.message || "Invalid request data" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create code value" },
      { status: 500 }
    );
  }
}
