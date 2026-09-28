import { NextResponse } from "next/server";
import {
  SALARY_ADVANCE_CALLBACK_SIGNATURE_HEADER,
  verifySalaryAdvancePaymentCallbackSignature,
} from "@/lib/salary-advance-payment-callback";
import { applySalaryAdvanceGeePayCallback } from "@/lib/salary-advance-geepay-settlement";

type PaymentCallbackBody = {
  status?: unknown;
  message?: unknown;
  transactionReference?: unknown;
  customer?: unknown;
  amount?: unknown;
  gatewayStatus?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Receives the terminal callback that Payment Service forwards after GeePay
 * confirms a disbursement. The signature is over the untouched request body.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (
    !verifySalaryAdvancePaymentCallbackSignature(
      rawBody,
      request.headers.get(SALARY_ADVANCE_CALLBACK_SIGNATURE_HEADER)
    )
  ) {
    return NextResponse.json({ error: "Invalid payment callback signature" }, { status: 401 });
  }

  let body: PaymentCallbackBody;
  try {
    body = JSON.parse(rawBody) as PaymentCallbackBody;
  } catch {
    return NextResponse.json({ error: "Invalid callback JSON" }, { status: 400 });
  }

  const status = asString(body.status)?.toUpperCase();
  const referenceNumber = asString(body.transactionReference);
  if (!status || !referenceNumber) {
    return NextResponse.json(
      { error: "status and transactionReference are required" },
      { status: 400 }
    );
  }

  const result = await applySalaryAdvanceGeePayCallback({
    status,
    referenceNumber,
    amount: body.amount,
    customer: asString(body.customer),
    message: asString(body.message),
    gatewayStatus: asString(body.gatewayStatus),
  });

  // A trusted terminal callback has been durably handled, including the
  // manual-review path. Returning 2xx prevents Payment Service retrying an
  // already-recorded amount mismatch or terminal failure indefinitely.
  return NextResponse.json({ success: result.outcome !== "manual_review", ...result });
}
