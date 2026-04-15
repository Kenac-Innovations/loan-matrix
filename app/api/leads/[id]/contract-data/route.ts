import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug, extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { format } from "date-fns";
import { fetchFineractAPI } from "@/lib/api";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";
import { getSession } from "@/lib/auth";

function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");

  if (host) {
    return `${forwardedProto || "https"}://${host}`;
  }

  return request.nextUrl.origin;
}

function getForwardedHeaders(request: NextRequest): HeadersInit {
  const forwardedHeaders: HeadersInit = {};

  for (const headerName of [
    "cookie",
    "origin",
    "referer",
    "x-forwarded-host",
    "x-forwarded-proto",
    "host",
  ]) {
    const value = request.headers.get(headerName);
    if (value) {
      forwardedHeaders[headerName] = value;
    }
  }

  return forwardedHeaders;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const rawBody = await response.text();

  if (!rawBody) {
    return {} as T;
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return {
      error:
        rawBody.length > 500
          ? `${rawBody.slice(0, 500)}…`
          : rawBody,
    } as T;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;
    console.log("Fetching contract data for leadId:", leadId);

    const tenantSlug = extractTenantSlugFromRequest(request);
    const requestOrigin = getRequestOrigin(request);
    const forwardedHeaders = getForwardedHeaders(request);
    console.log("Tenant slug:", tenantSlug);
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      console.error("Tenant not found for slug:", tenantSlug);
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    console.log("Tenant found:", tenant.id, tenant.slug);

    // Fetch lead with all necessary data (without tenant filter for compatibility)
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      select: {
        // Tenant
        tenantId: true,

        // Client information
        firstname: true,
        middlename: true,
        lastname: true,
        externalId: true,
        dateOfBirth: true,
        gender: true,
        genderId: true,
        mobileNo: true,
        countryCode: true,
        accountNumber: true,
        fineractAccountNo: true,
        fineractClientId: true,
        officeName: true,

        // Loan details
        loanProductName: true,
        loanProductId: true,
        loanPurpose: true,
        loanPurposeId: true,
        loanOfficerId: true,
        fundId: true,
        submittedOnDate: true,
        expectedDisbursementDate: true,
        requestedAmount: true,

        // Affordability
        annualIncome: true,
        monthlyIncome: true,
        grossMonthlyIncome: true,
        monthlyExpenses: true,
        employmentStatus: true,
        employerName: true,
        yearsEmployed: true,
        yearsAtCurrentJob: true,
        businessType: true,
        businessOwnership: true,
        collateralType: true,
        collateralValue: true,
        bankName: true,
        existingLoans: true,
        hasExistingLoans: true,
        nationality: true,

        // State metadata (contains loan terms)
        stateMetadata: true,
        stateContext: true,
        familyMembers: true,
      },
    });

    if (!lead) {
      console.error("Lead not found with ID:", leadId);
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 },
      );
    }

    console.log("Lead found:", leadId);

    // Warn if tenant mismatch (but don't block the request)
    if (lead.tenantId !== tenant.id) {
      console.warn(
        `⚠️ Tenant mismatch for lead ${leadId}: lead.tenantId=${lead.tenantId}, expected=${tenant.id}`,
      );
    }

    // Fetch loan details
    console.log("Fetching loan details...");
    const loanDetailsResponse = await fetch(
      `${requestOrigin}/api/leads/${leadId}/loan-details`,
      {
        headers: forwardedHeaders,
        cache: "no-store",
      },
    );
    const loanDetailsResult = await readJsonResponse<{
      success?: boolean;
      data?: any;
      error?: string;
    }>(loanDetailsResponse);
    const loanDetails = loanDetailsResult.success
      ? loanDetailsResult.data
      : null;
    console.log("Loan details fetched:", loanDetails ? "Found" : "Not found");

    // Fetch loan terms
    console.log("Fetching loan terms...");
    const loanTermsResponse = await fetch(
      `${requestOrigin}/api/leads/${leadId}/loan-terms`,
      {
        headers: forwardedHeaders,
        cache: "no-store",
      },
    );
    const loanTermsResult = await readJsonResponse<{
      success?: boolean;
      data?: any;
      error?: string;
    }>(loanTermsResponse);
    const loanTerms = loanTermsResult.success ? loanTermsResult.data : null;
    console.log("Loan terms fetched:", loanTerms ? "Found" : "Not found");

    // Check if we have the minimum required data
    if (!lead.fineractClientId) {
      console.error("Missing fineractClientId");
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing Fineract Client ID. Please complete the client details first.",
        },
        { status: 400 },
      );
    }

    if (!lead.loanProductId && !loanDetails?.productId) {
      console.error("Missing loanProductId");
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing loan product information. Please complete the loan details first.",
        },
        { status: 400 },
      );
    }

    if (!loanTerms) {
      console.error("Missing loan terms");
      return NextResponse.json(
        {
          success: false,
          error: "Missing loan terms. Please complete the loan terms first.",
        },
        { status: 400 },
      );
    }

    // Fetch Fineract client details to get gender and other client info
    let fineractClient: any = null;
    if (lead.fineractClientId) {
      try {
        console.log("Fetching Fineract client details for gender...");
        fineractClient = await fetchFineractAPI(
          `/clients/${lead.fineractClientId}`,
        );
        console.log(
          "Fineract client fetched, gender:",
          fineractClient?.gender,
        );
      } catch (err) {
        console.error("Error fetching Fineract client details:", err);
      }
    }

    // Fetch client addresses from Fineract for residential/work address
    let residentialAddress: string | null = null;
    let workAddress: string | null = null;
    if (lead.fineractClientId) {
      try {
        const addresses = await fetchFineractAPI(
          `/client/${lead.fineractClientId}/addresses`,
        );
        const addressList = Array.isArray(addresses) ? addresses : [];
        for (const addr of addressList) {
          const parts = [
            addr.addressLine1,
            addr.addressLine2,
            addr.addressLine3,
            addr.city,
            addr.townVillage,
            addr.district,
          ].filter(Boolean);
          const fullAddress = parts.join(", ");
          const typeName = (addr.addressType?.name || addr.addressType || "")
            .toString()
            .toLowerCase();
          if (
            typeName.includes("home") ||
            typeName.includes("residence") ||
            typeName.includes("physical") ||
            !residentialAddress
          ) {
            if (!residentialAddress && fullAddress) residentialAddress = fullAddress;
          }
          if (
            typeName.includes("work") ||
            typeName.includes("office") ||
            typeName.includes("business")
          ) {
            if (fullAddress) workAddress = fullAddress;
          }
        }
        if (!residentialAddress && addressList.length > 0) {
          const first = addressList[0];
          residentialAddress = [
            first.addressLine1,
            first.addressLine2,
            first.addressLine3,
            first.city,
            first.townVillage,
          ]
            .filter(Boolean)
            .join(", ");
        }
      } catch (err) {
        console.error("Error fetching client addresses:", err);
      }
    }

    // Derive spouse and closest relative from family members
    const familyMembers = (lead.familyMembers || []) as Array<{
      firstname: string;
      middlename?: string | null;
      lastname: string;
      relationship?: string | null;
      mobileNo?: string | null;
    }>;
    const spouseRelation = ["spouse", "wife", "husband", "partner"];
    let spouseName: string | null = null;
    let spousePhone: string | null = null;
    let closestRelativeName: string | null = null;
    let closestRelativePhone: string | null = null;
    let closestRelativeRelationship: string | null = null;
    for (const fm of familyMembers) {
      const rel = (fm.relationship || "").toLowerCase();
      const name = [fm.firstname, fm.middlename, fm.lastname]
        .filter(Boolean)
        .join(" ");
      if (spouseRelation.some((r) => rel.includes(r))) {
        if (!spouseName) {
          spouseName = name || null;
          spousePhone = (fm.mobileNo as string) || null;
        }
      } else if (!closestRelativeName && name) {
        closestRelativeName = name;
        closestRelativePhone = (fm.mobileNo as string) || null;
        closestRelativeRelationship = (fm.relationship as string) || null;
      }
    }

    // Fetch client template to get gender options (fallback)
    let clientTemplate: any = null;
    try {
      const clientTemplateResponse = await fetch(
        `${requestOrigin}/api/fineract/clients/template`,
        {
          headers: forwardedHeaders,
          cache: "no-store",
        },
      );
      if (clientTemplateResponse.ok) {
        clientTemplate = await readJsonResponse<any>(clientTemplateResponse);
      }
    } catch (err) {
      console.error("Error fetching client template:", err);
    }

    // Fetch loan template for additional info
    let loanTemplate: any = null;
    if (lead.fineractClientId && loanDetails?.productId) {
      try {
        const templateResponse = await fetch(
          `${requestOrigin}/api/fineract/loans/template?clientId=${lead.fineractClientId}&productId=${loanDetails.productId}&activeOnly=true&staffInSelectedOfficeOnly=true&templateType=individual`,
          {
            headers: forwardedHeaders,
            cache: "no-store",
          },
        );
        if (templateResponse.ok) {
          loanTemplate = await readJsonResponse<any>(templateResponse);
        }
      } catch (err) {
        console.error("Error fetching loan template:", err);
      }
    }

    // Calculate repayment schedule
    let repaymentSchedule: any = null;
    if (loanTerms && loanDetails && loanTemplate) {
      try {
        const submittedDate = loanDetails.submittedOn
          ? format(new Date(loanDetails.submittedOn), "dd MMMM yyyy")
          : format(new Date(), "dd MMMM yyyy");

        const disbursementDate = loanDetails.disbursementOn
          ? format(new Date(loanDetails.disbursementOn), "dd MMMM yyyy")
          : format(new Date(), "dd MMMM yyyy");

        const charges = (loanTerms.charges || []).map((charge: any) => ({
          chargeId: charge.chargeId,
          amount: charge.amount,
          dueDate: charge.dueDate,
        }));

        const payload = {
          productId: parseInt(loanDetails.productId, 10),
          loanOfficerId: loanDetails.loanOfficer || "",
          loanPurposeId: loanDetails.loanPurpose || "",
          fundId: loanDetails.fund || "",
          submittedOnDate: submittedDate,
          expectedDisbursementDate: disbursementDate,
          externalId: "",
          linkAccountId: loanDetails.linkSavings || "",
          createStandingInstructionAtDisbursement:
            loanDetails.createStandingInstructions ? "true" : "",
          loanTermFrequency: loanTerms.loanTerm || 1,
          loanTermFrequencyType: loanTerms.termFrequency
            ? parseInt(loanTerms.termFrequency)
            : loanTemplate?.termPeriodFrequencyType?.id || 2,
          numberOfRepayments: loanTerms.numberOfRepayments || 1,
          repaymentEvery: loanTerms.repaymentEvery || 1,
          repaymentFrequencyType: loanTerms.repaymentFrequency
            ? parseInt(loanTerms.repaymentFrequency)
            : loanTemplate?.repaymentFrequencyType?.id || 2,
          repaymentFrequencyNthDayType:
            loanTerms.repaymentFrequencyNthDay || "",
          repaymentFrequencyDayOfWeekType:
            loanTerms.repaymentFrequencyDayOfWeek || "",
          repaymentsStartingFromDate: loanTerms.firstRepaymentOn
            ? format(new Date(loanTerms.firstRepaymentOn), "dd MMMM yyyy")
            : null,
          interestChargedFromDate: loanTerms.interestChargedFrom
            ? format(new Date(loanTerms.interestChargedFrom), "dd MMMM yyyy")
            : null,
          interestType: loanTerms.interestMethod
            ? parseInt(loanTerms.interestMethod)
            : loanTemplate?.interestType?.id || 1,
          isEqualAmortization: loanTerms.isEqualAmortization || false,
          amortizationType: loanTerms.amortization
            ? parseInt(loanTerms.amortization)
            : loanTemplate?.amortizationType?.id || 1,
          interestCalculationPeriodType: loanTerms.interestCalculationPeriod
            ? parseInt(loanTerms.interestCalculationPeriod)
            : loanTemplate?.interestCalculationPeriodType?.id || 1,
          loanIdToClose: loanTerms.loanIdToClose || "",
          isTopup: loanTerms.isTopup ? true : "",
          transactionProcessingStrategyCode:
            loanTerms.repaymentStrategy ||
            loanTemplate?.transactionProcessingStrategyCode ||
            "creocore-strategy",
          interestRateFrequencyType: loanTerms.interestRateFrequency
            ? parseInt(loanTerms.interestRateFrequency)
            : loanTemplate?.interestRateFrequencyType?.id || 2,
          interestRatePerPeriod: loanTerms.nominalInterestRate || 0,
          charges: charges,
          collateral: [],
          dateFormat: "dd MMMM yyyy",
          locale: "en",
          clientId: lead.fineractClientId,
          loanType: "individual",
          principal: loanTerms.principal || 0,
          allowPartialPeriodInterestCalcualtion: false,
        };

        const scheduleResponse = await fetch(
          `${requestOrigin}/api/fineract/loans/calculate-schedule`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...forwardedHeaders,
            },
            body: JSON.stringify(payload),
          },
        );

        if (scheduleResponse.ok) {
          repaymentSchedule = await readJsonResponse<any>(scheduleResponse);
        }
      } catch (err) {
        console.error("Error calculating repayment schedule:", err);
      }
    }

    // Format data for contracts
    const clientName = [lead.firstname, lead.middlename, lead.lastname]
      .filter(Boolean)
      .join(" ");

    // Normalize ZMK to ZMW (Fineract uses legacy ZMK code)
    const orgCurrency = await getOrgDefaultCurrencyCode();
    const rawCurrency =
      loanTemplate?.currency?.code ||
      repaymentSchedule?.currency?.code ||
      orgCurrency;
    const currency = rawCurrency === "ZMK" ? "ZMW" : rawCurrency;
    const principal = loanTerms?.principal || 0;
    const interest = repaymentSchedule?.totalInterestCharged || 0;
    const fees = repaymentSchedule?.totalFeeChargesCharged || 0;
    const totalRepayment =
      repaymentSchedule?.totalRepaymentExpected || principal + interest + fees;

    // Calculate monthly percentage rate
    const numberOfPayments = loanTerms?.numberOfRepayments || 1;
    const monthlyPercentageRate =
      principal > 0
        ? (((interest + fees) / principal) * 100) / numberOfPayments
        : 0;

    // Format repayment schedule for contracts
    const formattedSchedule =
      repaymentSchedule?.periods
        ?.filter(
          (period: any) =>
            period.period !== undefined && !period.downPaymentPeriod,
        )
        .map((period: any) => ({
          paymentNumber: period.period,
          dueDate: Array.isArray(period.dueDate)
            ? format(
                new Date(
                  period.dueDate[0],
                  period.dueDate[1] - 1,
                  period.dueDate[2],
                ),
                "dd/MM/yyyy",
              )
            : format(new Date(period.dueDate), "dd/MM/yyyy"),
          paymentAmount:
            period.totalDueForPeriod || period.totalOriginalDueForPeriod || 0,
          principal: period.principalDue || period.principalDisbursed || 0,
          interestAndFees:
            (period.interestDue || 0) + (period.feeChargesDue || 0),
          remainingBalance: period.principalLoanBalanceOutstanding || 0,
        })) || [];

    // Get frequency label
    const getFrequencyLabel = (typeId: number): string => {
      const types: { [key: number]: string } = {
        0: "Days",
        1: "Weeks",
        2: "Months",
        3: "Years",
      };
      return types[typeId] || "Months";
    };

    const repaymentFrequency = loanTerms?.repaymentFrequency
      ? getFrequencyLabel(parseInt(loanTerms.repaymentFrequency))
      : "Monthly";

    // Format tenure
    const tenure =
      loanTerms?.loanTerm && loanTerms?.termFrequency
        ? `${loanTerms.loanTerm} ${getFrequencyLabel(
            parseInt(loanTerms.termFrequency),
          )}`
        : `${numberOfPayments} ${repaymentFrequency}`;

    // Get first payment date
    const firstPaymentDate =
      formattedSchedule.length > 0
        ? formattedSchedule[0].dueDate
        : format(new Date(), "dd/MM/yyyy");

    // Format charges
    const formattedCharges = (loanTerms?.charges || []).map((charge: any) => ({
      name: charge.name || "Unknown Charge",
      amount: charge.amount || 0,
    }));

    // Get loan officer name from logged-in user
    let loanOfficerName = "N/A";
    try {
      const session = await getSession();
      if (session?.user?.userId) {
        // Fetch user details from Fineract to get firstname and lastname
        const userDetails = await fetchFineractAPI(
          `/users/${session.user.userId}`,
        );
        if (userDetails?.firstname || userDetails?.lastname) {
          loanOfficerName =
            [userDetails.firstname, userDetails.lastname]
              .filter(Boolean)
              .join(" ") || "N/A";
          console.log(
            "Loan Officer Name from logged-in user:",
            loanOfficerName,
          );
        }
      }
    } catch (err) {
      console.error(
        "Error fetching logged-in user details for loan officer:",
        err,
      );
      // Fallback to loan template lookup if user details fetch fails
      if (loanTemplate?.loanOfficerOptions && loanDetails?.loanOfficer) {
        const officer = loanTemplate.loanOfficerOptions.find(
          (o: any) => o.id.toString() === loanDetails.loanOfficer,
        );
        loanOfficerName = officer?.displayName || "N/A";
      }
    }

    // Get loan purpose name
    let loanPurposeName = "N/A";
    if (loanTemplate?.loanPurposeOptions && loanDetails?.loanPurpose) {
      const purpose = loanTemplate.loanPurposeOptions.find(
        (p: any) => p.id.toString() === loanDetails.loanPurpose,
      );
      loanPurposeName = purpose?.name || "N/A";
    }

    // Net disbursed amount (principal - upfront fees)
    const upfrontFees = formattedCharges
      .filter(
        (c) =>
          !c.name.toLowerCase().includes("monthly") &&
          !c.name.toLowerCase().includes("recurring"),
      )
      .reduce((sum, c) => sum + c.amount, 0);
    const disbursedAmount = principal - upfrontFees;

    // Get gender name - priority: Fineract client > genderId map > lead.gender > template lookup
    let genderName = "N/A";
    const FINERACT_GENDER_MAP: Record<number, string> = { 15: "Male", 16: "Female" };
    console.log("Gender debug:", { gender: lead.gender, genderId: lead.genderId, fineractGender: fineractClient?.gender });
    if (fineractClient?.gender?.name) {
      genderName = fineractClient.gender.name;
      console.log("Gender from Fineract client:", genderName);
    } else if (lead.genderId && FINERACT_GENDER_MAP[lead.genderId]) {
      genderName = FINERACT_GENDER_MAP[lead.genderId];
      console.log("Gender from genderId map:", genderName);
    } else if (lead.gender && lead.gender !== "null" && lead.gender !== "N/A") {
      genderName = lead.gender;
      console.log("Gender from lead.gender:", genderName);
    } else if (lead.genderId && clientTemplate?.genderOptions) {
      const genderOption = clientTemplate.genderOptions.find(
        (g: any) => g.id === lead.genderId,
      );
      genderName = genderOption?.name || "N/A";
      console.log("Gender from template lookup:", genderName);
    }

    // Fetch all Fineract client datatables for contract data
    let employerName: string | undefined = undefined;
    let employeeNo: string | undefined = undefined;
    let dtMaritalStatus: string | undefined = undefined;
    let dtSpouseName: string | undefined = undefined;
    let dtSpousePhone: string | undefined = undefined;
    let dtClosestRelativeName: string | undefined = undefined;
    let dtClosestRelativePhone: string | undefined = undefined;
    let dtClosestRelativeRelationship: string | undefined = undefined;
    let dtBusinessSector: string | undefined = undefined;
    let dtBusinessAddress: string | undefined = undefined;
    let dtCollaterals: Array<{ description?: string }> = [];
    let dtReferees: Array<{
      name?: string;
      occupation?: string;
      relation?: string;
      address?: string;
      phone?: string;
    }> = [];

    if (lead.fineractClientId) {
      try {
        console.log("Fetching datatables for client:", lead.fineractClientId);
        const datatables = await fetchFineractAPI(
          `/datatables?apptable=m_client`,
        );
        console.log(
          "Available datatables:",
          datatables.map((dt: any) => dt.registeredTableName),
        );

        const resolveCodeValue = (header: any, rawValue: any): string => {
          if (rawValue == null) return "";
          if (
            header.columnDisplayType === "CODELOOKUP" &&
            Array.isArray(header.columnValues)
          ) {
            const match = header.columnValues.find(
              (cv: any) => cv.id === rawValue || cv.id === Number(rawValue),
            );
            return match?.value || match?.name || String(rawValue);
          }
          return String(rawValue);
        };

        for (const dt of datatables) {
          const tableName = dt.registeredTableName || "";
          const lowerName = tableName.toLowerCase();
          try {
            const dtData = await fetchFineractAPI(
              `/datatables/${encodeURIComponent(tableName)}/${lead.fineractClientId}?genericResultSet=true`,
            );
            const headers = dtData?.columnHeaders || [];
            const rows = dtData?.data || [];
            if (rows.length === 0) continue;

            const getVal = (row: any[], colMatch: (name: string) => boolean) => {
              const idx = headers.findIndex((h: any) =>
                colMatch((h.columnName || "").toLowerCase().replace(/\s+/g, "_")),
              );
              return idx >= 0 ? row[idx] : undefined;
            };

            const getResolvedVal = (
              row: any[],
              colMatch: (name: string) => boolean,
            ): string => {
              const idx = headers.findIndex((h: any) =>
                colMatch((h.columnName || "").toLowerCase().replace(/\s+/g, "_")),
              );
              if (idx < 0) return "";
              return resolveCodeValue(headers[idx], row[idx]);
            };

            // --- Employment Information ---
            if (
              lowerName.includes("employment") ||
              lowerName.includes("employer")
            ) {
              const firstRow = rows[0]?.row || [];
              if (!employerName) {
                const val = getVal(firstRow, (n) => n.includes("employer"));
                if (val) employerName = resolveCodeValue(
                  headers[headers.findIndex((h: any) =>
                    (h.columnName || "").toLowerCase().replace(/\s+/g, "_").includes("employer"),
                  )],
                  val,
                );
              }
              if (!employeeNo) {
                const val = getVal(
                  firstRow,
                  (n) => n.includes("employee") && n.includes("num"),
                );
                if (val) employeeNo = String(val);
              }
            }

            // --- Business Info ---
            if (lowerName.includes("business")) {
              const firstRow = rows[0]?.row || [];
              if (!dtBusinessSector) {
                dtBusinessSector = getResolvedVal(
                  firstRow,
                  (n) => n.includes("business") && (n.includes("sector") || n.includes("type")),
                );
              }
              if (!dtBusinessAddress) {
                const val = getVal(firstRow, (n) => n === "address" || n.includes("address"));
                if (val) dtBusinessAddress = String(val);
              }
            }

            // --- Family Situation ---
            if (lowerName.includes("family")) {
              const firstRow = rows[0]?.row || [];
              if (!dtMaritalStatus) {
                dtMaritalStatus = getResolvedVal(
                  firstRow,
                  (n) => n.includes("marital"),
                );
              }
              if (!dtSpouseName) {
                const val = getVal(firstRow, (n) => n.includes("spouse") && n.includes("name"));
                if (val) dtSpouseName = String(val);
              }
              if (!dtSpousePhone) {
                const val = getVal(
                  firstRow,
                  (n) => n.includes("spouse") && (n.includes("phone") || n.includes("tel")),
                );
                if (val) dtSpousePhone = String(val);
              }
              if (!dtClosestRelativeName) {
                const val = getVal(
                  firstRow,
                  (n) => n.includes("closest") && n.includes("name"),
                );
                if (val) dtClosestRelativeName = String(val);
              }
              if (!dtClosestRelativePhone) {
                const val = getVal(
                  firstRow,
                  (n) => n.includes("closest") && (n.includes("phone") || n.includes("tel")),
                );
                if (val) dtClosestRelativePhone = String(val);
              }
              if (!dtClosestRelativeRelationship) {
                dtClosestRelativeRelationship = getResolvedVal(
                  firstRow,
                  (n) => n.includes("relation"),
                );
              }
            }

            // --- Proposed Security (multi-row) ---
            if (lowerName.includes("security") || lowerName.includes("collateral")) {
              for (const rowObj of rows) {
                const row = rowObj?.row || [];
                const desc = getVal(row, (n) => n.includes("description") || n === "description");
                if (desc) dtCollaterals.push({ description: String(desc) });
              }
            }

            // --- Referees (multi-row) ---
            if (lowerName.includes("referee")) {
              for (const rowObj of rows) {
                const row = rowObj?.row || [];
                const name = getVal(row, (n) => n === "name");
                const occupation = getVal(row, (n) => n === "occupation");
                const relation = getResolvedVal(row, (n) => n.includes("relation"));
                const address = getVal(row, (n) => n === "address");
                const phone = getVal(
                  row,
                  (n) => n.includes("telephone") || n.includes("phone") || n.includes("tel"),
                );
                dtReferees.push({
                  name: name ? String(name) : undefined,
                  occupation: occupation ? String(occupation) : undefined,
                  relation: relation || undefined,
                  address: address ? String(address) : undefined,
                  phone: phone ? String(phone) : undefined,
                });
              }
            }
          } catch (err) {
            console.warn(`Failed to fetch datatable "${tableName}":`, err);
          }
        }

        console.log("Datatable extraction complete:", {
          employerName,
          employeeNo,
          dtBusinessSector,
          dtBusinessAddress,
          dtMaritalStatus,
          dtSpouseName,
          dtClosestRelativeName,
          dtCollaterals: dtCollaterals.length,
          dtReferees: dtReferees.length,
        });
      } catch (err) {
        console.error("Error fetching client datatables:", err);
      }
    }

    const loanDateFormatted =
      lead.expectedDisbursementDate
        ? format(new Date(lead.expectedDisbursementDate), "dd/MM/yyyy")
        : lead.submittedOnDate
          ? format(new Date(lead.submittedOnDate), "dd/MM/yyyy")
          : format(new Date(), "dd/MM/yyyy");

    const nominalInterestRate =
      loanTerms?.nominalInterestRate ?? repaymentSchedule?.annualInterestRate ?? 0;
    const executionPlace = lead.officeName || "Head Office";
    const executionDate = loanDateFormatted;
    const executionDay = lead.expectedDisbursementDate
      ? format(new Date(lead.expectedDisbursementDate), "d")
      : format(new Date(), "d");
    const executionMonth = lead.expectedDisbursementDate
      ? format(new Date(lead.expectedDisbursementDate), "MMMM")
      : format(new Date(), "MMMM");
    const executionYear = lead.expectedDisbursementDate
      ? format(new Date(lead.expectedDisbursementDate), "yyyy")
      : format(new Date(), "yyyy");

    const contractData = {
      // Client Information
      clientName,
      nrc: lead.externalId || "N/A",
      dateOfBirth: lead.dateOfBirth
        ? format(new Date(lead.dateOfBirth), "dd/MM/yyyy")
        : "N/A",
      gender: genderName,
      employeeNo: employeeNo,
      employer: employerName,
      gflNo: lead.fineractClientId?.toString() || undefined,
      loanId: leadId,

      // Loan Information
      loanAmount: principal,
      disbursedAmount: disbursedAmount,
      tenure: tenure,
      numberOfPayments: numberOfPayments,
      paymentFrequency: repaymentFrequency,
      firstPaymentDate: firstPaymentDate,

      // Financial Information
      interest: interest,
      fees: fees,
      totalCostOfCredit: interest + fees,
      totalRepayment: totalRepayment,
      paymentPerPeriod:
        formattedSchedule.length > 0
          ? formattedSchedule.reduce(
              (sum: number, p: any) => sum + p.paymentAmount,
              0,
            ) / formattedSchedule.length
          : totalRepayment / numberOfPayments,
      monthlyPercentageRate: monthlyPercentageRate,
      nominalInterestRate,

      // Schedule
      repaymentSchedule: formattedSchedule,

      // Charges
      charges: formattedCharges,

      // Other
      currency: currency,
      branch: lead.officeName || "Head Office",
      loanOfficer: loanOfficerName,
      loanPurpose: loanPurposeName,
      executionPlace,
      executionDate,
      executionDay,
      executionMonth,
      executionYear,

      // Address & family (for contract prepopulation — Fineract datatables take priority)
      residentialAddress:
        residentialAddress ||
        (lead.stateContext as any)?.residentialAddress ||
        (lead.stateContext as any)?.physicalAddress ||
        (lead.stateMetadata as any)?.residentialAddress ||
        null,
      workAddress:
        workAddress ||
        dtBusinessAddress ||
        (lead.stateContext as any)?.workAddress ||
        (lead.stateMetadata as any)?.workAddress ||
        null,
      spouseName:
        dtSpouseName ||
        spouseName ||
        (lead.stateContext as any)?.spouseName ||
        (lead.stateMetadata as any)?.spouseName ||
        null,
      spousePhone:
        dtSpousePhone ||
        spousePhone ||
        (lead.stateContext as any)?.spousePhone ||
        (lead.stateMetadata as any)?.spousePhone ||
        null,
      closestRelativeName:
        dtClosestRelativeName ||
        closestRelativeName ||
        (lead.stateContext as any)?.closestRelativeName ||
        (lead.stateMetadata as any)?.closestRelativeName ||
        null,
      closestRelativePhone:
        dtClosestRelativePhone ||
        closestRelativePhone ||
        (lead.stateContext as any)?.closestRelativePhone ||
        (lead.stateMetadata as any)?.closestRelativePhone ||
        null,
      closestRelativeRelationship:
        dtClosestRelativeRelationship ||
        closestRelativeRelationship ||
        (lead.stateContext as any)?.closestRelativeRelationship ||
        (lead.stateMetadata as any)?.closestRelativeRelationship ||
        null,
      maritalStatus: dtMaritalStatus || null,
      businessSector: dtBusinessSector || null,
      businessAddress: dtBusinessAddress || null,
      collaterals: dtCollaterals.length > 0 ? dtCollaterals : null,
      referees: dtReferees.length > 0 ? dtReferees : null,

      // Extra fields for tenant-specific templates
      firstname: lead.firstname || null,
      middlename: lead.middlename || null,
      lastname: lead.lastname || null,
      mobileNo: lead.mobileNo || null,
      countryCode: lead.countryCode || null,
      accountNumber: lead.fineractAccountNo || lead.accountNumber || null,
      loanDate: loanDateFormatted,
      requestedAmount: lead.requestedAmount ?? null,
      annualIncome: lead.annualIncome ?? null,
      monthlyIncome: lead.monthlyIncome ?? null,
      grossMonthlyIncome: lead.grossMonthlyIncome ?? null,
      monthlyExpenses: lead.monthlyExpenses ?? null,
      employmentStatus: lead.employmentStatus || null,
      employerName: lead.employerName || employerName || null,
      yearsEmployed: lead.yearsEmployed ?? null,
      yearsAtCurrentJob: lead.yearsAtCurrentJob || null,
      businessType: lead.businessType || null,
      businessOwnership: lead.businessOwnership ?? null,
      collateralType: lead.collateralType || null,
      collateralValue: lead.collateralValue ?? null,
      bankName: lead.bankName || null,
      existingLoans: lead.existingLoans ?? null,
      hasExistingLoans: lead.hasExistingLoans ?? null,
      nationality: lead.nationality || null,
      familyMembers: lead.familyMembers || [],
      stateContext: lead.stateContext || null,
      stateMetadata: lead.stateMetadata || null,
    };

    return NextResponse.json({
      success: true,
      data: contractData,
    });
  } catch (error) {
    console.error("Error fetching contract data:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch contract data: ${errorMessage}`,
      },
      { status: 500 },
    );
  }
}
