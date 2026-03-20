import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, position, isActive } = body;

    console.log("Adding new loan purpose:", { name, description, position });

    const codes = await fetchFineractAPI("/codes");
    const loanPurposeCode = codes.find(
      (code: any) => code.name === "LoanPurpose"
    );

    if (!loanPurposeCode) {
      throw new Error("LoanPurpose code not found in Fineract");
    }

    const result = await fetchFineractAPI(
      `/codes/${loanPurposeCode.id}/codevalues`,
      {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          position: position || 0,
          isActive: isActive !== undefined ? isActive : true,
        }),
      }
    );

    console.log("Successfully added loan purpose:", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error adding loan purpose:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to add loan purpose",
      },
      { status: 500 }
    );
  }
}
