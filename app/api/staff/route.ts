import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

export async function GET(request: NextRequest) {
  try {
    const fineractService = await getFineractServiceWithSession();
    const staff = await fineractService.getStaff();

    return NextResponse.json(staff);
  } catch (error) {
    console.error("Failed to get staff:", error);
    return NextResponse.json(
      { error: "Failed to get staff" },
      { status: 500 }
    );
  }
} 