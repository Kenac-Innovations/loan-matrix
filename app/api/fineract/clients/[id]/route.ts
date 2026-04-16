import { NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

/**
 * GET /api/fineract/clients/[id]
 * Fetches detailed client information by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = Number(id);

    console.log("Client Details API: Fetching client", { id, clientId });

    if (!Number.isFinite(clientId) || clientId <= 0) {
      return NextResponse.json(
        { error: `Invalid Fineract client ID: ${id}` },
        { status: 400 }
      );
    }

    const fineractService = await getFineractServiceWithSession();
    const data = await fineractService.getClient(clientId);

    console.log("Client Details API: Fetched client data:", {
      hasData: !!data,
      clientId: data?.id,
      clientName: data?.displayName,
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching client details:", error);

    // Better error handling for different error types
    const errorMessage =
      error?.message || error?.errorData?.defaultUserMessage || "Unknown error";
    const statusCode = error?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.errorData || null,
      },
      { status: statusCode }
    );
  }
}

/**
 * PUT /api/fineract/clients/[id]
 * Updates a specific client
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = Number(id);
    const payload = await request.json();

    if (!Number.isFinite(clientId) || clientId <= 0) {
      return NextResponse.json(
        { error: `Invalid Fineract client ID: ${id}` },
        { status: 400 }
      );
    }

    const fineractService = await getFineractServiceWithSession();
    const data = await fineractService.updateClient(clientId, payload);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating client:", error);

    // Better error handling for different error types
    const errorMessage =
      error?.message || error?.errorData?.defaultUserMessage || "Unknown error";
    const statusCode = error?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.errorData || null,
      },
      { status: statusCode }
    );
  }
}

/**
 * DELETE /api/fineract/clients/[id]
 * Deletes a specific client
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = Number(id);

    if (!Number.isFinite(clientId) || clientId <= 0) {
      return NextResponse.json(
        { error: `Invalid Fineract client ID: ${id}` },
        { status: 400 }
      );
    }

    const fineractService = await getFineractServiceWithSession();
    await fineractService.deleteClient(clientId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting client:", error);

    // Better error handling for different error types
    const errorMessage =
      error?.message || error?.errorData?.defaultUserMessage || "Unknown error";
    const statusCode = error?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.errorData || null,
      },
      { status: statusCode }
    );
  }
}
