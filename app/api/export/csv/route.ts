import { NextRequest, NextResponse } from "next/server";
import { streamCSVExport } from "@/app/actions/export-actions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, columns, filename } = body;

    if (!data || !columns || !filename) {
      return NextResponse.json(
        { error: "Missing required fields: data, columns, filename" },
        { status: 400 }
      );
    }

    const result = await streamCSVExport(data, columns, filename);

    if (!result.success || !result.stream) {
      return NextResponse.json(
        { error: result.error || "Failed to generate CSV stream" },
        { status: 500 }
      );
    }

    // Set headers for CSV download
    const headers = new Headers();
    headers.set("Content-Type", "text/csv");
    headers.set("Content-Disposition", `attachment; filename="${filename}.csv"`);
    headers.set("Cache-Control", "no-cache");

    return new NextResponse(result.stream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("CSV export API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Alternative GET endpoint for simple exports
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename") || "export";
  
  // This would typically fetch data from your database
  // For demo purposes, returning empty data
  const data = [];
  const columns = [
    { id: "id", header: "ID", accessorKey: "id" },
    { id: "name", header: "Name", accessorKey: "name" },
  ];

  const result = await streamCSVExport(data, columns, filename);

  if (!result.success || !result.stream) {
    return NextResponse.json(
      { error: result.error || "Failed to generate CSV stream" },
      { status: 500 }
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", "text/csv");
  headers.set("Content-Disposition", `attachment; filename="${filename}.csv"`);
  headers.set("Cache-Control", "no-cache");

  return new NextResponse(result.stream, {
    status: 200,
    headers,
  });
}
