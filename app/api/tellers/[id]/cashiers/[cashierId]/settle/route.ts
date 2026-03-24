import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { isPaymentTypeCash } from "@/lib/cash-repayment-teller";
import { sendLoanStatusSms } from "@/lib/notification-service";

/**
 * POST /api/tellers/[id]/cashiers/[cashierId]/settle
 * Settle/withdraw cash from a cashier (cash out transaction)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; cashierId: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId, cashierId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, currency, notes, date, transactionType, loanPayoutId } =
      body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (!currency) {
      return NextResponse.json(
        { error: "Currency is required" },
        { status: 400 }
      );
    }

    // Validate transaction type
    const txnType = transactionType || "EXPENSE";
    if (!["EXPENSE", "DISBURSEMENT", "CREDIT_BALANCE_REFUND"].includes(txnType)) {
      return NextResponse.json(
        {
          error:
            "Invalid transaction type. Must be EXPENSE, DISBURSEMENT or CREDIT_BALANCE_REFUND",
        },
        { status: 400 }
      );
    }

    // If DISBURSEMENT, validate and fetch/create the loan payout record
    let loanPayout = null;
    if (txnType === "DISBURSEMENT") {
      if (!loanPayoutId) {
        return NextResponse.json(
          { error: "Loan payout ID is required for disbursement transactions" },
          { status: 400 }
        );
      }

      // Check if loanPayoutId is a fineract loan ID (number) or database ID (string)
      const isNumericId = !isNaN(Number(loanPayoutId));

      console.log(
        `Processing disbursement for loanPayoutId: ${loanPayoutId}, isNumeric: ${isNumericId}, tenantId: ${tenant.id}`
      );

      if (isNumericId) {
        // It's a Fineract loan ID - find or create the payout record
        loanPayout = await prisma.loanPayout.findUnique({
          where: {
            tenantId_fineractLoanId: {
              tenantId: tenant.id,
              fineractLoanId: Number(loanPayoutId),
            },
          },
        });

        console.log(
          `Existing payout lookup result:`,
          loanPayout
            ? { id: loanPayout.id, status: loanPayout.status }
            : "Not found"
        );

        // If payout record doesn't exist, create it by fetching loan details from Fineract
        if (!loanPayout) {
          console.log(`Creating new payout record for loan ${loanPayoutId}`);
          try {
            const fineractService = await getFineractServiceWithSession();
            const loanDetails = await fineractService.getLoan(
              Number(loanPayoutId)
            );

            if (loanDetails) {
              console.log(`Loan details fetched:`, {
                id: loanDetails.id,
                clientId: loanDetails.clientId,
                clientName: loanDetails.clientName,
                accountNo: loanDetails.accountNo,
              });
              loanPayout = await prisma.loanPayout.create({
                data: {
                  tenantId: tenant.id,
                  fineractLoanId: loanDetails.id,
                  fineractClientId: loanDetails.clientId,
                  clientName: loanDetails.clientName || "Unknown Client",
                  loanAccountNo: loanDetails.accountNo || "",
                  amount:
                    loanDetails.principal ||
                    loanDetails.approvedPrincipal ||
                    parseFloat(amount),
                  currency: loanDetails.currency?.code || currency,
                  status: "PENDING",
                },
              });
              console.log(`Payout record created:`, {
                id: loanPayout.id,
                tenantId: loanPayout.tenantId,
                fineractLoanId: loanPayout.fineractLoanId,
              });
            }
          } catch (fetchError) {
            console.error(
              "Error fetching loan details from Fineract:",
              fetchError
            );
          }
        }
      } else {
        // It's a database payout ID
        loanPayout = await prisma.loanPayout.findFirst({
          where: {
            id: loanPayoutId,
            tenantId: tenant.id,
          },
        });
      }

      if (!loanPayout) {
        return NextResponse.json(
          { error: "Loan payout record not found and could not be created" },
          { status: 404 }
        );
      }

      if (loanPayout.status === "PAID") {
        return NextResponse.json(
          { error: "This loan has already been paid out" },
          { status: 400 }
        );
      }

      if (loanPayout.status === "VOIDED" || loanPayout.status === "REVERSED") {
        return NextResponse.json(
          { error: "This loan payout has been voided or reversed" },
          { status: 400 }
        );
      }

      // Cashier balance may only change for cash disbursements.
      // Verify the loan's disbursement was made with a cash payment method.
      try {
        const fineractService = await getFineractServiceWithSession();
        const transactions = await fineractService.getLoanTransactions(
          loanPayout.fineractLoanId
        );

        if (transactions.length > 0) {
          const disburseTxn = transactions.find((t: any) => t.type?.disbursement);
          const paymentTypeId =
            disburseTxn?.paymentDetailData?.paymentType?.id ?? null;

          if (paymentTypeId == null) {
            // No payment type on disbursement - log warning but allow the payout
            // Some Fineract configurations don't require payment type on disbursement
            console.warn(
              `Loan ${loanPayout.fineractLoanId}: Disbursement has no payment type recorded. Proceeding with payout.`
            );
          } else {
            const isCash = await isPaymentTypeCash(paymentTypeId);
            if (!isCash) {
              return NextResponse.json(
                {
                  error:
                    "Disbursement must use a cash payment method to process payout from cashier. The loan was disbursed with a non-cash payment method.",
                },
                { status: 400 }
              );
            }
          }
        } else {
          // No transactions found - loan may have just been disbursed, proceed with warning
          console.warn(
            `Loan ${loanPayout.fineractLoanId}: No transactions found. Proceeding with payout.`
          );
        }
      } catch (err) {
        // Log the error but don't block the payout - the verification is a safety check,
        // not a hard requirement. Blocking the cashier from doing their job is worse.
        console.error(
          "Error verifying disbursement payment type (proceeding with payout):",
          err instanceof Error ? err.message : err
        );
      }
    }

    // Handle fineract-prefixed IDs
    let dbTellerId = tellerId;
    let fineractTellerIdFromPrefix: number | null = null;
    if (tellerId.startsWith("fineract-")) {
      fineractTellerIdFromPrefix = parseInt(tellerId.replace("fineract-", ""));
    }

    // Get teller
    let teller = await prisma.teller.findFirst({
      where: { id: dbTellerId, tenantId: tenant.id },
    });

    // Try by Fineract ID if not found
    const fineractTellerIdToSearch =
      fineractTellerIdFromPrefix ||
      (!isNaN(Number(tellerId)) ? Number(tellerId) : null);
    if (!teller && fineractTellerIdToSearch) {
      teller = await prisma.teller.findFirst({
        where: {
          fineractTellerId: fineractTellerIdToSearch,
          tenantId: tenant.id,
        },
      });
    }

    if (!teller || !teller.fineractTellerId) {
      return NextResponse.json(
        { error: "Teller not found or does not have a Fineract ID" },
        { status: 404 }
      );
    }

    // Parse cashierId - could be database ID or Fineract ID
    const cashierIdNum = parseInt(cashierId);
    const isNumericId = !isNaN(cashierIdNum);

    // Try to find cashier by database ID first
    let cashier = await prisma.cashier.findFirst({
      where: { id: cashierId, tellerId: teller.id, tenantId: tenant.id },
    });

    // If not found by database ID and cashierId is numeric, try Fineract ID
    if (!cashier && isNumericId) {
      cashier = await prisma.cashier.findFirst({
        where: {
          fineractCashierId: cashierIdNum,
          tellerId: teller.id,
          tenantId: tenant.id,
        },
      });
    }

    // Get Fineract cashier ID
    let fineractCashierId: number;
    if (cashier?.fineractCashierId) {
      fineractCashierId = cashier.fineractCashierId;
    } else if (isNumericId) {
      fineractCashierId = cashierIdNum;
    } else {
      return NextResponse.json(
        { error: "Invalid cashier ID format" },
        { status: 400 }
      );
    }

    // If cashier doesn't exist in database, sync from Fineract
    if (!cashier) {
      try {
        const fineractService = await getFineractServiceWithSession();
        const fineractCashier = await fineractService.getCashier(
          teller.fineractTellerId,
          fineractCashierId
        );

        const parseFineractDate = (dateInput: any): Date => {
          if (Array.isArray(dateInput)) {
            return new Date(dateInput[0], dateInput[1] - 1, dateInput[2]);
          } else if (typeof dateInput === "string") {
            return new Date(dateInput);
          }
          return new Date();
        };

        cashier = await prisma.cashier.create({
          data: {
            tenantId: tenant.id,
            tellerId: teller.id,
            fineractCashierId: fineractCashier.id,
            staffId: fineractCashier.staffId || 0,
            staffName:
              fineractCashier.staffName || `Staff ${fineractCashier.staffId}`,
            startDate: parseFineractDate(fineractCashier.startDate),
            endDate: fineractCashier.endDate
              ? parseFineractDate(fineractCashier.endDate)
              : null,
            isFullDay:
              fineractCashier.isFullDay !== undefined
                ? fineractCashier.isFullDay
                : true,
            status: "ACTIVE",
          },
        });
      } catch (error: any) {
        console.error("Error creating cashier from Fineract:", error.message);
      }
    }

    if (!cashier) {
      return NextResponse.json({ error: "Cashier not found" }, { status: 404 });
    }

    // Check if cashier has an active session - required for cash out
    let activeSession = await prisma.cashierSession.findFirst({
      where: {
        tellerId: teller.id,
        cashierId: cashier.id,
        tenantId: tenant.id,
        sessionStatus: "ACTIVE",
      },
    });

    // If no local session found, check Fineract for active session and sync
    if (!activeSession) {
      try {
        const fineractService = await getFineractServiceWithSession();
        const fineractCashierData = await fineractService.getCashier(
          teller.fineractTellerId,
          fineractCashierId
        );

        // Check if Fineract shows cashier as having an active session
        // Fineract returns session data with the cashier
        if (fineractCashierData?.isRunning) {
          console.log(
            `Fineract shows active session for cashier ${fineractCashierId}, syncing...`
          );
          // Create a local session record to sync with Fineract
          activeSession = await prisma.cashierSession.create({
            data: {
              tenantId: tenant.id,
              tellerId: teller.id,
              cashierId: cashier.id,
              fineractSessionId: fineractCashierData.id || 0,
              sessionStatus: "ACTIVE",
              sessionStartTime: new Date(),
              allocatedBalance: 0,
              availableBalance: 0,
              openingFloat: 0,
              cashIn: 0,
              cashOut: 0,
              netCash: 0,
            },
          });
          console.log(`Created local session for cashier ${cashier.id}`);
        }
      } catch (error) {
        console.error("Error checking Fineract session:", error);
      }
    }

    // Customer-facing cash-outs require an active cashier session.
    // For settlements to vault (after close), allow if there's a recent closed session
    if (
      !activeSession &&
      (txnType === "DISBURSEMENT" || txnType === "CREDIT_BALANCE_REFUND")
    ) {
      return NextResponse.json(
        {
          error: "Session required",
          details:
            "Cashier must have an active session for customer cash-out transactions. Please start a session first.",
        },
        { status: 400 }
      );
    }

    // For non-disbursement settlements (return to vault), check if there's a closed session
    if (
      !activeSession &&
      txnType !== "DISBURSEMENT" &&
      txnType !== "CREDIT_BALANCE_REFUND"
    ) {
      const closedSession = await prisma.cashierSession.findFirst({
        where: {
          tellerId: teller.id,
          cashierId: cashier.id,
          tenantId: tenant.id,
          sessionStatus: "CLOSED",
        },
        orderBy: { sessionEndTime: "desc" },
      });

      if (!closedSession) {
        return NextResponse.json(
          {
            error: "Session required",
            details:
              "Cashier must have an active or recently closed session for cash settlement.",
          },
          { status: 400 }
        );
      }
      // Allow settlement with closed session (return to vault after close)
      console.log(
        `Allowing settlement with closed session ${closedSession.id}`
      );
    }

    // Format date for Fineract
    const formatDateForFineract = (dateInput: string | Date): string => {
      const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
      const day = d.getDate();
      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      return `${day.toString().padStart(2, "0")} ${month} ${year}`;
    };

    const txnDate = date
      ? formatDateForFineract(date)
      : formatDateForFineract(new Date());

    // Settle cash in Fineract (cash out transaction)
    let fineractSettlementId: number | null = null;
    try {
      const fineractService = await getFineractServiceWithSession();
      console.log("Calling Fineract settleCashForCashier with:", {
        tellerId: teller.fineractTellerId,
        cashierId: fineractCashierId,
        txnDate,
        currencyCode: currency,
        txnAmount: amount.toString(),
      });
      const result = await fineractService.settleCashForCashier(
        teller.fineractTellerId,
        fineractCashierId,
        {
          txnDate,
          currencyCode: currency,
          txnAmount: amount.toString(),
          txnNote: notes || "Cash Out",
          dateFormat: "dd MMMM yyyy",
          locale: "en",
        }
      );
      fineractSettlementId = result.resourceId || result.id || null;
      console.log("Fineract settle response:", result);
    } catch (error: any) {
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      };
      console.error("Error settling cash in Fineract:", errorDetails);
      // Return full error details so user can see what went wrong
      return NextResponse.json(
        {
          error: "Failed to settle cash in Fineract",
          details:
            error.response?.data?.defaultUserMessage ||
            error.response?.data?.errors?.[0]?.defaultUserMessage ||
            error.message,
          fineractError: error.response?.data || null,
          debugInfo: {
            tellerId: teller.fineractTellerId,
            cashierId: fineractCashierId,
            txnDate,
            currencyCode: currency,
            txnAmount: amount.toString(),
          },
        },
        { status: error.response?.status || 500 }
      );
    }

    // Check if this fineract settlement already exists in our database
    if (fineractSettlementId) {
      const existingSettlement = await prisma.cashAllocation.findUnique({
        where: { fineractAllocationId: fineractSettlementId },
      });

      if (existingSettlement) {
        // Settlement already recorded, but also update loan payout if this is a disbursement
        if (
          txnType === "DISBURSEMENT" &&
          loanPayout &&
          loanPayout.status !== "PAID"
        ) {
          console.log(
            `Updating loan payout ${loanPayout.id} to PAID (existing settlement)`
          );
          await prisma.loanPayout.update({
            where: { id: loanPayout.id },
            data: {
              status: "PAID",
              paymentMethod: "CASH",
              paidAt: new Date(),
              paidBy: session.user.id,
              cashierId: cashier?.id,
              tellerId: teller.id,
            },
          });
        }

        // Determine if return to vault for existing settlement
        const existingIsReturnToVault = txnType !== "DISBURSEMENT" &&
          txnType !== "CREDIT_BALANCE_REFUND" &&
          (existingSettlement.notes?.toLowerCase().includes("vault") || 
           existingSettlement.notes?.toLowerCase().includes("safe") || 
           existingSettlement.notes?.toLowerCase().includes("settlement") ||
           existingSettlement.notes?.toLowerCase().includes("return"));

        return NextResponse.json({
          success: true,
          transaction: existingSettlement,
          type: existingIsReturnToVault ? "RETURN_TO_VAULT" : "CASH_OUT",
          message: "Settlement already recorded",
          loanPayoutId: loanPayout?.id || null,
        });
      }
    }

    // Distinguish vault returns from customer-facing cash-outs.
    const isCustomerCashOut =
      txnType === "DISBURSEMENT" || txnType === "CREDIT_BALANCE_REFUND";
    const isReturnToVault = !isCustomerCashOut;
    
    console.log(`Settlement type: ${txnType}, isReturnToVault: ${isReturnToVault}, amount: ${amount}`);
    
    // Create a negative allocation record (cash out from cashier)
    const settlementNotes =
      txnType === "DISBURSEMENT"
        ? `Loan Disbursement: ${loanPayout?.clientName} - ${
            loanPayout?.loanAccountNo
          }${notes ? ` - ${notes}` : ""}`
        : txnType === "CREDIT_BALANCE_REFUND"
        ? notes || "Credit Balance Refund"
        : notes || "Return to Vault";

    const settlement = await prisma.cashAllocation.create({
      data: {
        tenantId: tenant.id,
        tellerId: teller.id,
        cashierId: cashier.id,
        fineractAllocationId: fineractSettlementId,
        amount: -parseFloat(amount), // Negative for cash out
        currency: currency,
        allocatedBy: session.user.id,
        notes: settlementNotes,
        status: "ACTIVE",
      },
    });
    console.log(`Created cashier settlement: ID=${settlement.id}, cashierId=${cashier.id}, amount=-${amount} ${currency}`);

    // Disbursements: money moves from the cashier balance only (cashier pays customer from till).
    // Do NOT create a vault allocation — the vault is untouched. The cashier allocation above is the only record.

    // For return to vault: do NOT create a local vault allocation. Vault is derived from
    // Bank Allocation - Cashier Balances (Fineract); when Fineract cashier balance
    // decreases, vault automatically increases. A local record would double count.
    console.log(`Settlement type: ${txnType}, isReturnToVault: ${isReturnToVault}`);

    // If this is a disbursement, update the loan payout record
    if (txnType === "DISBURSEMENT" && loanPayout) {
      console.log(`Updating loan payout ${loanPayout.id} to PAID status`);
      const updatedPayout = await prisma.loanPayout.update({
        where: { id: loanPayout.id },
        data: {
          status: "PAID",
          paymentMethod: "CASH",
          paidAt: new Date(),
          paidBy: session.user.id,
          cashierId: cashier.id,
          tellerId: teller.id,
          notes: notes || undefined,
        },
      });
      console.log(`Loan payout updated:`, {
        id: updatedPayout.id,
        fineractLoanId: updatedPayout.fineractLoanId,
        status: updatedPayout.status,
        paidAt: updatedPayout.paidAt,
      });

      // Send SMS: payout completed (best-effort)
      try {
        const lead = await prisma.lead.findFirst({
          where: {
            tenantId: tenant.id,
            fineractLoanId: updatedPayout.fineractLoanId,
          },
          select: { mobileNo: true, firstname: true, middlename: true, lastname: true },
        });
        const phone = lead?.mobileNo ?? null;
        if (phone) {
          const clientName =
            updatedPayout.clientName ||
            (lead
              ? [lead.firstname, lead.middlename, lead.lastname].filter(Boolean).join(" ")
              : "Customer");
          await sendLoanStatusSms({
            type: "paid",
            clientName: clientName || "Customer",
            phone,
            amount: updatedPayout.amount,
            currency: updatedPayout.currency || "ZMW",
            tenantId: tenant.slug,
          });
        }
      } catch (smsError) {
        console.error("Failed to send paid SMS:", smsError);
      }
    }

    // Update the cashier session status to SETTLED (only for end-of-day settlements)
    // Don't update for regular cash out transactions
    // const today = new Date();
    // today.setHours(0, 0, 0, 0);
    // await prisma.cashierSession.updateMany({...});

    return NextResponse.json({
      success: true,
      transaction: settlement,
      type: isReturnToVault ? "RETURN_TO_VAULT" : "CASH_OUT",
      transactionType: txnType,
      amount: parseFloat(amount),
      currency,
      fineractSettlementId,
      loanPayoutId: loanPayout?.id || null,
      vaultUpdated: isReturnToVault,
    });
  } catch (error) {
    console.error("Error settling cash:", error);
    return NextResponse.json(
      {
        error: "Failed to settle cash",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
