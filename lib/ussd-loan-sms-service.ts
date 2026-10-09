import prisma from "@/lib/prisma";
import { sendSms } from "@/lib/notification-service";

export type UssdLoanApplicationSmsEvent = "submission" | "rejection";

type UssdLoanApplicationSmsInput = {
  applicationId: string;
  tenantId: string;
  userFullName: string;
  userPhoneNumber: string;
  principalAmount: number;
  referenceNumber: string;
  event: UssdLoanApplicationSmsEvent;
};

function formatLoanAmount(amount: number): string {
  if (!Number.isFinite(amount)) {
    return "0";
  }

  return new Intl.NumberFormat("en-ZM", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function buildUssdLoanApplicationSmsMessage(input: {
  event: UssdLoanApplicationSmsEvent;
  userFullName: string;
  principalAmount: number;
  referenceNumber: string;
}): string {
  const customerName = input.userFullName.trim() || "Customer";
  const amount = formatLoanAmount(input.principalAmount);
  const referenceNumber = input.referenceNumber.trim() || "N/A";

  if (input.event === "rejection") {
    return `Dear ${customerName}, we regret to inform you that your loan application of K${amount} has been rejected. Reference: ${referenceNumber}.`;
  }

  return `Dear ${customerName}, we have received your loan application of K${amount}. Reference: ${referenceNumber}. Disbursement is in progress.`;
}

async function claimUssdLoanApplicationSmsAttempt(
  applicationId: string,
  event: UssdLoanApplicationSmsEvent
): Promise<boolean> {
  const result =
    event === "submission"
      ? await prisma.ussdLoanApplication.updateMany({
          where: { id: applicationId, submissionSmsAttemptedAt: null },
          data: { submissionSmsAttemptedAt: new Date() },
        })
      : await prisma.ussdLoanApplication.updateMany({
          where: { id: applicationId, rejectionSmsAttemptedAt: null },
          data: { rejectionSmsAttemptedAt: new Date() },
        });

  return result.count === 1;
}

/**
 * Sends a USSD application SMS without delaying or changing loan processing.
 * The atomic attempt marker prevents queue retries from sending the same event
 * more than once. Delivery failures are logged for operational follow-up.
 */
export function dispatchUssdLoanApplicationSms(
  input: UssdLoanApplicationSmsInput
): void {
  void (async () => {
    const claimed = await claimUssdLoanApplicationSmsAttempt(
      input.applicationId,
      input.event
    );

    if (!claimed) {
      return;
    }

    const delivered = await sendSms(
      [input.userPhoneNumber],
      buildUssdLoanApplicationSmsMessage(input),
      { tenantId: input.tenantId }
    );

    if (!delivered) {
      console.error(
        `[USSD Loan SMS] ${input.event} SMS was not accepted for application ${input.applicationId} (reference ${input.referenceNumber})`
      );
    }
  })().catch((error) => {
    console.error(
      `[USSD Loan SMS] Failed to dispatch ${input.event} SMS for application ${input.applicationId} (reference ${input.referenceNumber}):`,
      error
    );
  });
}
