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
 * GET /api/fineract/codes/[codeName]/codevalues
 * Fetches all code values for the specified code name
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ codeName: string }> }
) {
  try {
    const { codeName } = await params;

    const codeId = await getCodeIdByName(codeName);
    if (!codeId) {
      return NextResponse.json(
        { error: `Code '${codeName}' not found` },
        { status: 404 }
      );
    }

    const data = await fetchFineractAPI(`/codes/${codeId}/codevalues`);
    
    // Filter to only active values by default, unless ?includeInactive=true
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    
    const codeValues = Array.isArray(data) ? data : data?.data || [];
    const filteredValues = includeInactive 
      ? codeValues 
      : codeValues.filter((cv: any) => cv.isActive !== false);

    return NextResponse.json(filteredValues);
  } catch (error: any) {
    console.error(`Error fetching code values for ${(await params).codeName}:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch code values" },
      { status: 500 }
    );
  }
}

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
    const { name, description, position, isActive, createCodeIfNotExists } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let codeId = await getCodeIdByName(codeName);

    // Optionally create the code if it doesn't exist
    if (!codeId && createCodeIfNotExists) {
      const newCode = await fetchFineractAPI("/codes", {
        method: "POST",
        body: JSON.stringify({ name: codeName }),
      });
      codeId = newCode.resourceId || newCode.id;
    }

    if (!codeId) {
      return NextResponse.json(
        { error: `Code '${codeName}' not found` },
        { status: 404 }
      );
    }

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
