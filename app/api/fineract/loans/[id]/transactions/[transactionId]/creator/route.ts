import { NextResponse } from "next/server";
import { getLoanTransactionCreator } from "@/lib/fineract-loan-transaction-creator";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; transactionId: string }>;
  }
) {
  try {
    const { transactionId } = await params;
    const loanTransactionId = Number(transactionId);

    if (!Number.isInteger(loanTransactionId) || loanTransactionId <= 0) {
      return NextResponse.json(
        { error: "A valid loan transaction id is required" },
        { status: 400 }
      );
    }

    const creator = await getLoanTransactionCreator({
      loanTransactionId,
    });

    return NextResponse.json(creator);
  } catch (error: unknown) {
    console.error("Error fetching loan transaction creator:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch loan transaction creator",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
