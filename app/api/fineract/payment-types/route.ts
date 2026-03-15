import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET() {
  try {
    const data = await fetchFineractAPI("/paymenttypes");
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching payment types:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment types" },
      { status: error.status || 500 }
    );
  }
}
