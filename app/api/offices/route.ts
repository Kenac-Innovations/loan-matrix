import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

export async function GET(request: NextRequest) {
  try {
    const fineractService = await getFineractServiceWithSession();
    const offices = await fineractService.getOffices();

    return NextResponse.json(offices);
  } catch (error) {
    console.error("Failed to get offices:", error);
    return NextResponse.json(
      { error: "Failed to get offices" },
      { status: 500 }
    );
  }
} 