import { NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { hasSuperAdminServer } from "@/lib/authorization";

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

    console.log("Client Details API: Fetching client", { id });

    const fineractService = await getFineractServiceWithSession();
    const data = await fineractService.getClient(parseInt(id));

    console.log("Client Details API: Fetched client data:", {
      hasData: !!data,
      clientId: data?.id,
      clientName: data?.displayName,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Error fetching client details:", error);

    // Better error handling for different error types
    const errorObj = error as {
      message?: string;
      errorData?: { defaultUserMessage?: string };
      status?: number;
    };
    const errorMessage =
      errorObj?.message ||
      errorObj?.errorData?.defaultUserMessage ||
      "Unknown error";
    const statusCode = errorObj?.status || 500;

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
    if (!(await hasSuperAdminServer())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const payload = await request.json();

    const fineractService = await getFineractServiceWithSession();
    const data = await fineractService.updateClient(parseInt(id), payload);

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Error updating client:", error);

    // Better error handling for different error types
    const errorObj = error as {
      message?: string;
      errorData?: { defaultUserMessage?: string };
      status?: number;
    };
    const errorMessage =
      errorObj?.message ||
      errorObj?.errorData?.defaultUserMessage ||
      "Unknown error";
    const statusCode = errorObj?.status || 500;

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
    if (!(await hasSuperAdminServer())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const fineractService = await getFineractServiceWithSession();
    await fineractService.deleteClient(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting client:", error);

    // Better error handling for different error types
    const errorObj = error as {
      message?: string;
      errorData?: { defaultUserMessage?: string };
      status?: number;
    };
    const errorMessage =
      errorObj?.message ||
      errorObj?.errorData?.defaultUserMessage ||
      "Unknown error";
    const statusCode = errorObj?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.errorData || null,
      },
      { status: statusCode }
    );
  }
}
