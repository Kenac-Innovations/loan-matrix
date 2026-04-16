import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EntityStakeholderRole } from "@/app/generated/prisma";
import { z } from "zod";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { getSession } from "@/lib/auth";
import {
  getTenantFromHeaders,
  getTenantBySlug,
  extractTenantSlug,
} from "@/lib/tenant-service";

// Helper to resolve the current tenant, optionally using the raw request
// so we can read middleware-set and proxy-set headers directly.
async function resolveCurrentTenant(tx?: any, req?: Request) {
  if (req) {
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const host = req.headers.get("host");
    console.log("[resolveCurrentTenant] headers:", { origin, referer, host, hasReq: !!req });

    if (origin) {
      try {
        const t = await getTenantBySlug(extractTenantSlug(new URL(origin).hostname));
        if (t) return t;
      } catch {}
    }
    if (referer) {
      try {
        const t = await getTenantBySlug(extractTenantSlug(new URL(referer).hostname));
        if (t) return t;
      } catch {}
    }
  }

  try {
    const tenant = await getTenantFromHeaders();
    if (tenant) return tenant;
  } catch {}

  const fallbackSlug = process.env.FINERACT_TENANT_ID || "goodfellow";
  const db = tx || prisma;
  const fallbackTenant = await db.tenant.findFirst({
    where: { slug: fallbackSlug, isActive: true },
    select: { id: true, name: true, slug: true, domain: true, settings: true },
  });
  if (!fallbackTenant) {
    throw new Error(
      `Tenant '${fallbackSlug}' not found. Please ensure the tenant exists in the database.`
    );
  }
  return fallbackTenant;
}

// Helper function to format dates for Fineract API
const formatDateForFineract = (
  date: Date | string | number | null | undefined
): string => {
  // Handle null, undefined, or empty values
  if (date === null || date === undefined) {
    return new Date().toISOString().split("T")[0];
  }

  // Convert to Date object based on input type
  let dateObj: Date;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === "string") {
    dateObj = new Date(date);
  } else if (typeof date === "number") {
    dateObj = new Date(date);
  } else {
    console.error("==========> Invalid date type:", typeof date, date);
    return new Date().toISOString().split("T")[0];
  }

  // Validate that the date is valid
  if (isNaN(dateObj.getTime())) {
    console.error("==========> Invalid date value:", date);
    return new Date().toISOString().split("T")[0];
  }

  // Return date in yyyy-MM-dd format as expected by Fineract
  return dateObj.toISOString().split("T")[0];
};

// Client form schema - uses z.coerce.date() to handle strings, numbers, and Date objects
const clientFormSchema = z.object({
  officeId: z.number(),
  officeName: z.string().optional(),
  legalFormId: z.number(),
  legalFormName: z.string().optional(),
  externalId: z.string().optional(),
  firstname: z.string().optional(),
  middlename: z.string().optional(),
  lastname: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.union([z.string(), z.number()]).optional().transform(val => val !== undefined ? String(val) : undefined),
  genderId: z.number().optional(),
  fullname: z.string().optional(),
  tradingName: z.string().optional(),
  registrationNumber: z.string().optional(),
  dateOfIncorporation: z.coerce.date().optional(),
  natureOfBusiness: z.string().optional(),
  businessAddress: z.string().optional(),
  isStaff: z.boolean().default(false),
  mobileNo: z.string(),
  countryCode: z.string().default("+260"),
  emailAddress: z.union([z.string().email(), z.literal("")]).default(""),
  clientTypeId: z.number().optional(),
  clientTypeName: z.string().optional(),
  clientClassificationId: z.number().optional(),
  clientClassificationName: z.string().optional(),
  submittedOnDate: z.coerce.date().default(() => new Date()),
  active: z.boolean().default(true),
  activationDate: z.coerce.date().optional(),
  openSavingsAccount: z.boolean().default(false),
  savingsProductId: z.number().optional(),
  savingsProductName: z.string().optional(),
  currentStep: z.number().default(1),
  // Financial fields
  monthlyIncomeRange: z.string().optional(),
  employmentStatus: z.string().optional(),
  employerName: z.string().optional(),
  yearsAtCurrentJob: z.string().optional(),
  hasExistingLoans: z.boolean().default(false),
  monthlyDebtPayments: z.number().optional(),
  propertyOwnership: z.string().optional(),
  businessOwnership: z.boolean().default(false),
  businessType: z.string().optional(),
});

// Holds the current request so resolveCurrentTenant can read headers
// without changing every handler's signature.
let _currentRequest: Request | undefined;

const ENTITY_LEGAL_FORM_ID = 2;

async function resolveLeadIdForEntityOps(
  leadId: string | undefined,
  data: any,
  req?: Request
): Promise<string> {
  if (leadId) return leadId;
  const fromBody = data?.leadId as string | undefined;
  if (fromBody) return fromBody;
  const fineractClientId = data?.fineractClientId;
  if (fineractClientId == null) {
    throw new Error("leadId or fineractClientId is required");
  }
  const tenant = await resolveCurrentTenant(undefined, req);
  const lead = await prisma.lead.findFirst({
    where: {
      fineractClientId: Number(fineractClientId),
      tenantId: tenant.id,
    },
    select: { id: true },
  });
  if (!lead) {
    throw new Error("No lead found for this Fineract client in your tenant");
  }
  return lead.id;
}

async function assertLeadIsEntity(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { legalFormId: true },
  });
  if (!lead) throw new Error("Lead not found");
  if (lead.legalFormId !== ENTITY_LEGAL_FORM_ID) {
    throw new Error(
      "Directors, shareholders, and entity banking apply only to Entity legal form"
    );
  }
}

async function validateProofDocument(
  leadId: string,
  docId: string | null | undefined
) {
  if (!docId) return;
  const doc = await prisma.leadDocument.findFirst({
    where: { id: docId, leadId },
  });
  if (!doc) {
    throw new Error("Proof of residence document not found for this lead");
  }
}

async function validateShareholderTotals(leadId: string) {
  const rows = await prisma.entityStakeholder.findMany({
    where: { leadId, role: EntityStakeholderRole.SHAREHOLDER },
    select: { shareholdingPercentage: true },
  });
  const total = rows.reduce(
    (s, r) => s + Number(r.shareholdingPercentage ?? 0),
    0
  );
  if (total > 100.001) {
    throw new Error("Total shareholding percentage cannot exceed 100%");
  }
}

function toNullableTrimmedString(value: any): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function toNullableNumber(value: any): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function persistEntityStructureDraftForLead(
  tx: any,
  leadId: string,
  legalFormId: number,
  payload: any
) {
  if (legalFormId !== ENTITY_LEGAL_FORM_ID) return;

  const rawStakeholders = Array.isArray(payload?.entityStakeholdersDraft)
    ? payload.entityStakeholdersDraft
    : [];
  const rawBankAccounts = Array.isArray(payload?.entityBankAccountsDraft)
    ? payload.entityBankAccountsDraft
    : [];

  const stakeholdersToCreate: any[] = [];
  let totalShareholding = 0;
  for (let i = 0; i < rawStakeholders.length; i++) {
    const raw = rawStakeholders[i] || {};
    const roleRaw = String(raw.role || "").toUpperCase();
    if (
      roleRaw !== EntityStakeholderRole.DIRECTOR &&
      roleRaw !== EntityStakeholderRole.SHAREHOLDER
    ) {
      continue;
    }

    const fullName = toNullableTrimmedString(raw.fullName);
    const nationalIdOrPassport = toNullableTrimmedString(raw.nationalIdOrPassport);
    const residentialAddress = toNullableTrimmedString(raw.residentialAddress);
    const allEmpty = !fullName && !nationalIdOrPassport && !residentialAddress;
    if (allEmpty) continue;
    if (!fullName || !nationalIdOrPassport || !residentialAddress) {
      throw new Error(
        `Incomplete stakeholder details at row ${i + 1}. Full name, national ID/passport, and residential address are required.`
      );
    }

    const sortOrderCandidate = Number(raw.sortOrder);
    const sortOrder = Number.isFinite(sortOrderCandidate)
      ? sortOrderCandidate
      : stakeholdersToCreate.length;

    let shareholdingPercentage: number | null = null;
    if (roleRaw === EntityStakeholderRole.SHAREHOLDER) {
      const shareCandidate = toNullableNumber(raw.shareholdingPercentage);
      if (shareCandidate == null) {
        throw new Error(
          `Incomplete stakeholder details at row ${i + 1}. Shareholding percentage is required for shareholders.`
        );
      }
      if (shareCandidate < 0 || shareCandidate > 100) {
        throw new Error(
          `Invalid shareholding percentage at row ${i + 1}. Value must be between 0 and 100.`
        );
      }
      shareholdingPercentage = shareCandidate;
      totalShareholding += shareCandidate;
    }

    const isUltimateBeneficialOwner =
      roleRaw === EntityStakeholderRole.SHAREHOLDER
        ? Boolean(raw.isUltimateBeneficialOwner)
        : false;

    const controlStructureCodeValueId = isUltimateBeneficialOwner
      ? toNullableNumber(raw.controlStructureCodeValueId)
      : null;

    stakeholdersToCreate.push({
      leadId,
      role: roleRaw,
      fullName,
      nationalIdOrPassport,
      residentialAddress,
      nationalIdFineractDocumentId: toNullableTrimmedString(
        raw.nationalIdFineractDocumentId
      ),
      proofOfResidenceLeadDocumentId: toNullableTrimmedString(
        raw.proofOfResidenceLeadDocumentId
      ),
      fineractDocumentId: toNullableTrimmedString(raw.fineractDocumentId),
      pepStatusCodeValueId: toNullableNumber(raw.pepStatusCodeValueId),
      pepStatusLabel: toNullableTrimmedString(raw.pepStatusLabel),
      shareholdingPercentage,
      isUltimateBeneficialOwner,
      controlStructureCodeValueId,
      controlStructureLabel: isUltimateBeneficialOwner
        ? toNullableTrimmedString(raw.controlStructureLabel)
        : null,
      sortOrder,
    });
  }

  if (totalShareholding > 100.001) {
    throw new Error("Total shareholding percentage cannot exceed 100%");
  }

  if (stakeholdersToCreate.length > 0) {
    await tx.entityStakeholder.createMany({ data: stakeholdersToCreate });
  }

  const bankAccountsToCreate: any[] = [];
  for (let i = 0; i < rawBankAccounts.length; i++) {
    const raw = rawBankAccounts[i] || {};
    const bankName = toNullableTrimmedString(raw.bankName);
    const accountNumber = toNullableTrimmedString(raw.accountNumber);
    const accountSignatories = toNullableTrimmedString(raw.accountSignatories) || "";
    const allEmpty = !bankName && !accountNumber && !accountSignatories;
    if (allEmpty) continue;
    if (!bankName || !accountNumber) {
      throw new Error(
        `Incomplete bank account details at row ${i + 1}. Bank name and account number are required.`
      );
    }

    const sortOrderCandidate = Number(raw.sortOrder);
    const sortOrder = Number.isFinite(sortOrderCandidate)
      ? sortOrderCandidate
      : bankAccountsToCreate.length;

    bankAccountsToCreate.push({
      leadId,
      bankName,
      accountNumber,
      accountSignatories,
      sortOrder,
    });
  }

  if (bankAccountsToCreate.length > 0) {
    await tx.entityBankAccount.createMany({ data: bankAccountsToCreate });
  }
}

/**
 * POST /api/leads/operations
 * Handles lead operations like save draft, submit, etc.
 */
export async function POST(request: Request) {
  _currentRequest = request;
  try {
    const body = await request.json();
    const { operation, data, leadId } = body;

    console.log("==========> API Route: Received request");
    console.log("==========> Operation:", operation);
    console.log("==========> Data:", data);
    console.log("==========> LeadId:", leadId);

    switch (operation) {
      case "saveDraft":
        return await handleSaveDraft(data, leadId);
      case "createLeadWithClient":
        return await handleCreateLeadWithClient(data);
      case "updateClient":
        return await handleUpdateClient(data, data.leadId);
      case "createClientInFineract":
        return await handleCreateClientInFineract(leadId);
      case "submitLead":
        return await handleSubmitLead(leadId);
      case "closeLead":
        return await handleCloseLead(leadId, data.reason);
      case "addFamilyMember":
        return await handleAddFamilyMember(leadId, data);
      case "removeFamilyMember":
        return await handleRemoveFamilyMember(data.id);
      case "upsertEntityStakeholder":
        return await handleUpsertEntityStakeholder(
          await resolveLeadIdForEntityOps(leadId, data, _currentRequest),
          data
        );
      case "removeEntityStakeholder":
        return await handleRemoveEntityStakeholder(
          await resolveLeadIdForEntityOps(leadId, data, _currentRequest),
          data.id
        );
      case "reorderEntityStakeholders":
        return await handleReorderEntityStakeholders(
          await resolveLeadIdForEntityOps(leadId, data, _currentRequest),
          data
        );
      case "replaceEntityBankAccounts":
        return await handleReplaceEntityBankAccounts(
          await resolveLeadIdForEntityOps(leadId, data, _currentRequest),
          data
        );
      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("==========> Error in lead operation:", error);
    console.error("==========> Error type:", typeof error);
    console.error("==========> Error message:", error.message);
    console.error("==========> Error stack:", error.stack);

    // Ensure we always return a proper error response
    const errorMessage = error.message || "Unknown error occurred";
    const errorResponse = { error: errorMessage };

    console.error("==========> Returning error response:", errorResponse);

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

async function handleSaveDraft(data: any, leadId?: string) {
  try {
    // Convert data types before validation
    const processedData = {
      ...data,
      // Convert string IDs to numbers
      officeId: data.officeId ? Number(data.officeId) : undefined,
      legalFormId: data.legalFormId ? Number(data.legalFormId) : undefined,
      clientTypeId: data.clientTypeId ? Number(data.clientTypeId) : undefined,
      clientClassificationId: data.clientClassificationId
        ? Number(data.clientClassificationId)
        : undefined,
      genderId: data.genderId ? Number(data.genderId) : undefined,
      // Convert date strings to Date objects
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      submittedOnDate: data.submittedOnDate
        ? new Date(data.submittedOnDate)
        : new Date(),
      activationDate: data.activationDate
        ? new Date(data.activationDate)
        : undefined,
      // Convert savingsProductId to number if it exists
      savingsProductId: data.savingsProductId
        ? Number(data.savingsProductId)
        : undefined,
      // Convert monthlyDebtPayments to number if it exists
      monthlyDebtPayments: data.monthlyDebtPayments
        ? Number(data.monthlyDebtPayments)
        : undefined,
    };

    // Validate data
    const validatedData = clientFormSchema.parse(processedData);

    // Get current user ID and tenant ID
    const session = await getSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }
    const userId = session.user.id;

    // Resolve current tenant from subdomain/headers
    const currentTenant = await resolveCurrentTenant(undefined, _currentRequest);
    const tenantId = currentTenant.id;

    if (leadId) {
      // Update existing lead
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          officeId: validatedData.officeId,
          officeName: validatedData.officeName,
          legalFormId: validatedData.legalFormId,
          legalFormName: validatedData.legalFormName,
          externalId: validatedData.externalId,
          firstname: validatedData.firstname,
          middlename: validatedData.middlename,
          lastname: validatedData.lastname,
          dateOfBirth: validatedData.dateOfBirth || undefined,
          gender: validatedData.gender,
          genderId: validatedData.genderId || undefined,
          fullname: validatedData.fullname,
          tradingName: validatedData.tradingName,
          registrationNumber: validatedData.registrationNumber,
          dateOfIncorporation: validatedData.dateOfIncorporation || undefined,
          natureOfBusiness: validatedData.natureOfBusiness,
          businessAddress: validatedData.businessAddress,
          isStaff: validatedData.isStaff,
          mobileNo: validatedData.mobileNo,
          countryCode: validatedData.countryCode,
          emailAddress: validatedData.emailAddress,
          clientTypeId: validatedData.clientTypeId || undefined,
          clientTypeName: validatedData.clientTypeName,
          clientClassificationId:
            validatedData.clientClassificationId || undefined,
          clientClassificationName: validatedData.clientClassificationName,
          submittedOnDate: validatedData.submittedOnDate,
          active: validatedData.active,
          activationDate: validatedData.activationDate || undefined,
          openSavingsAccount: validatedData.openSavingsAccount,
          savingsProductId: validatedData.savingsProductId || undefined,
          savingsProductName: validatedData.savingsProductName,
          currentStep: validatedData.currentStep,
          // Financial fields
          monthlyIncomeRange: validatedData.monthlyIncomeRange,
          employmentStatus: validatedData.employmentStatus,
          employerName: validatedData.employerName,
          yearsAtCurrentJob: validatedData.yearsAtCurrentJob,
          hasExistingLoans: validatedData.hasExistingLoans,
          monthlyDebtPayments: validatedData.monthlyDebtPayments,
          propertyOwnership: validatedData.propertyOwnership,
          businessOwnership: validatedData.businessOwnership,
          businessType: validatedData.businessType,
          status: "DRAFT",
        },
      });

      return NextResponse.json({ success: true, leadId });
    } else {
      // Create new lead
      const newLead = await prisma.lead.create({
        data: {
          userId,
          tenantId,
          officeId: validatedData.officeId,
          officeName: validatedData.officeName,
          legalFormId: validatedData.legalFormId,
          legalFormName: validatedData.legalFormName,
          externalId: validatedData.externalId,
          firstname: validatedData.firstname,
          middlename: validatedData.middlename,
          lastname: validatedData.lastname,
          dateOfBirth: validatedData.dateOfBirth || undefined,
          gender: validatedData.gender,
          genderId: validatedData.genderId || undefined,
          fullname: validatedData.fullname,
          tradingName: validatedData.tradingName,
          registrationNumber: validatedData.registrationNumber,
          dateOfIncorporation: validatedData.dateOfIncorporation || undefined,
          natureOfBusiness: validatedData.natureOfBusiness,
          businessAddress: validatedData.businessAddress,
          isStaff: validatedData.isStaff,
          mobileNo: validatedData.mobileNo,
          countryCode: validatedData.countryCode,
          emailAddress: validatedData.emailAddress,
          clientTypeId: validatedData.clientTypeId || undefined,
          clientTypeName: validatedData.clientTypeName,
          clientClassificationId:
            validatedData.clientClassificationId || undefined,
          clientClassificationName: validatedData.clientClassificationName,
          submittedOnDate: validatedData.submittedOnDate,
          active: validatedData.active,
          activationDate: validatedData.activationDate || undefined,
          openSavingsAccount: validatedData.openSavingsAccount,
          savingsProductId: validatedData.savingsProductId || undefined,
          savingsProductName: validatedData.savingsProductName,
          currentStep: validatedData.currentStep,
          // Financial fields
          monthlyIncomeRange: validatedData.monthlyIncomeRange,
          employmentStatus: validatedData.employmentStatus,
          employerName: validatedData.employerName,
          yearsAtCurrentJob: validatedData.yearsAtCurrentJob,
          hasExistingLoans: validatedData.hasExistingLoans,
          monthlyDebtPayments: validatedData.monthlyDebtPayments,
          propertyOwnership: validatedData.propertyOwnership,
          businessOwnership: validatedData.businessOwnership,
          businessType: validatedData.businessType,
          status: "DRAFT",
        },
      });

      return NextResponse.json({ success: true, leadId: newLead.id });
    }
  } catch (error: any) {
    console.error("Error saving draft:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save draft" },
      { status: 500 }
    );
  }
}

async function handleSubmitLead(leadId: string) {
  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "ACTIVE",
        currentStep: 2,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error submitting lead:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit lead" },
      { status: 500 }
    );
  }
}

async function handleCloseLead(leadId: string, reason: string) {
  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "CLOSED",
        closedReason: reason,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error closing lead:", error);
    return NextResponse.json(
      { error: error.message || "Failed to close lead" },
      { status: 500 }
    );
  }
}

async function handleAddFamilyMember(leadId: string, data: any) {
  try {
    const familyMember = await prisma.familyMember.create({
      data: {
        leadId,
        firstname: data.firstname,
        lastname: data.lastname,
        middlename: data.middlename,
        relationship: data.relationship,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        mobileNo: data.mobileNo,
        emailAddress: data.emailAddress,
        isDependent: data.isDependent || false,
      },
    });

    return NextResponse.json({ success: true, familyMember });
  } catch (error: any) {
    console.error("Error adding family member:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add family member" },
      { status: 500 }
    );
  }
}

async function handleRemoveFamilyMember(id: string) {
  try {
    await prisma.familyMember.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing family member:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove family member" },
      { status: 500 }
    );
  }
}

async function handleUpsertEntityStakeholder(leadId: string, data: any) {
  try {
    await assertLeadIsEntity(leadId);

    const role = data.role as EntityStakeholderRole;
    if (
      role !== EntityStakeholderRole.DIRECTOR &&
      role !== EntityStakeholderRole.SHAREHOLDER
    ) {
      return NextResponse.json({ error: "Invalid stakeholder role" }, { status: 400 });
    }

    await validateProofDocument(leadId, data.proofOfResidenceLeadDocumentId);

    const isDirector = role === EntityStakeholderRole.DIRECTOR;
    const sharePct =
      isDirector || data.shareholdingPercentage == null || data.shareholdingPercentage === ""
        ? null
        : Number(data.shareholdingPercentage);

    if (!isDirector && sharePct == null) {
      return NextResponse.json(
        { error: "shareholdingPercentage is required for shareholders" },
        { status: 400 }
      );
    }

    if (!isDirector && sharePct != null && (sharePct < 0 || sharePct > 100)) {
      return NextResponse.json(
        { error: "Shareholding must be between 0 and 100" },
        { status: 400 }
      );
    }

    const payload = {
      fullName: String(data.fullName ?? "").trim(),
      nationalIdOrPassport: String(data.nationalIdOrPassport ?? "").trim(),
      residentialAddress: String(data.residentialAddress ?? "").trim(),
      nationalIdFineractDocumentId:
        data.nationalIdFineractDocumentId != null &&
        String(data.nationalIdFineractDocumentId).trim() !== ""
          ? String(data.nationalIdFineractDocumentId).trim()
          : null,
      proofOfResidenceLeadDocumentId:
        data.proofOfResidenceLeadDocumentId || null,
      fineractDocumentId:
        data.fineractDocumentId != null && String(data.fineractDocumentId).trim() !== ""
          ? String(data.fineractDocumentId).trim()
          : null,
      pepStatusCodeValueId:
        data.pepStatusCodeValueId != null
          ? Number(data.pepStatusCodeValueId)
          : null,
      pepStatusLabel: data.pepStatusLabel
        ? String(data.pepStatusLabel)
        : null,
      shareholdingPercentage: isDirector ? null : sharePct,
      isUltimateBeneficialOwner: isDirector
        ? false
        : Boolean(data.isUltimateBeneficialOwner),
      controlStructureCodeValueId:
        isDirector || !data.isUltimateBeneficialOwner
          ? null
          : data.controlStructureCodeValueId != null
            ? Number(data.controlStructureCodeValueId)
            : null,
      controlStructureLabel:
        isDirector || !data.isUltimateBeneficialOwner
          ? null
          : data.controlStructureLabel
            ? String(data.controlStructureLabel)
            : null,
      sortOrder:
        data.sortOrder != null ? Number(data.sortOrder) : 0,
    };

    if (
      !payload.fullName ||
      !payload.nationalIdOrPassport ||
      !payload.residentialAddress ||
      !payload.nationalIdFineractDocumentId
    ) {
      return NextResponse.json(
        {
          error:
            "fullName, nationalIdOrPassport, residentialAddress, and nationalIdFineractDocumentId are required",
        },
        { status: 400 }
      );
    }

    const id = data.id as string | undefined;

    if (id) {
      const existing = await prisma.entityStakeholder.findFirst({
        where: { id, leadId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Stakeholder not found" }, { status: 404 });
      }
    }

    if (!isDirector && payload.isUltimateBeneficialOwner) {
      await prisma.entityStakeholder.updateMany({
        where: { leadId, role: EntityStakeholderRole.SHAREHOLDER },
        data: { isUltimateBeneficialOwner: false },
      });
    }

    let stakeholder;
    if (id) {
      stakeholder = await prisma.entityStakeholder.update({
        where: { id },
        data: {
          role,
          ...payload,
        },
        include: { proofOfResidenceDocument: true },
      });
    } else {
      stakeholder = await prisma.entityStakeholder.create({
        data: {
          leadId,
          role,
          ...payload,
        },
        include: { proofOfResidenceDocument: true },
      });
    }

    await validateShareholderTotals(leadId);

    return NextResponse.json({ success: true, stakeholder });
  } catch (error: any) {
    console.error("Error upserting entity stakeholder:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save stakeholder" },
      { status: 500 }
    );
  }
}

async function handleRemoveEntityStakeholder(leadId: string, id: string) {
  try {
    await assertLeadIsEntity(leadId);
    const row = await prisma.entityStakeholder.findFirst({
      where: { id, leadId },
    });
    if (!row) {
      return NextResponse.json({ error: "Stakeholder not found" }, { status: 404 });
    }
    await prisma.entityStakeholder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error removing entity stakeholder:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove stakeholder" },
      { status: 500 }
    );
  }
}

async function handleReorderEntityStakeholders(leadId: string, data: any) {
  try {
    await assertLeadIsEntity(leadId);
    const items = data.items as { id: string; sortOrder: number }[];
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: true });
    }
    const ids = items.map((i) => i.id);
    const count = await prisma.entityStakeholder.count({
      where: { leadId, id: { in: ids } },
    });
    if (count !== ids.length) {
      return NextResponse.json(
        { error: "One or more stakeholder ids are invalid" },
        { status: 400 }
      );
    }
    await prisma.$transaction(
      items.map((item) =>
        prisma.entityStakeholder.update({
          where: { id: item.id },
          data: { sortOrder: Number(item.sortOrder) },
        })
      )
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error reordering stakeholders:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reorder" },
      { status: 500 }
    );
  }
}

async function handleReplaceEntityBankAccounts(leadId: string, data: any) {
  try {
    await assertLeadIsEntity(leadId);
    const accounts = data.accounts as Array<{
      bankName: string;
      accountNumber: string;
      accountSignatories: string;
      sortOrder?: number;
    }>;
    if (!Array.isArray(accounts)) {
      return NextResponse.json(
        { error: "accounts array is required" },
        { status: 400 }
      );
    }
    for (const a of accounts) {
      if (
        !String(a.bankName ?? "").trim() ||
        !String(a.accountNumber ?? "").trim()
      ) {
        return NextResponse.json(
          { error: "Each account needs bankName and accountNumber" },
          { status: 400 }
        );
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.entityBankAccount.deleteMany({ where: { leadId } });
      if (accounts.length === 0) return;
      await tx.entityBankAccount.createMany({
        data: accounts.map((a, idx) => ({
          leadId,
          bankName: String(a.bankName).trim(),
          accountNumber: String(a.accountNumber).trim(),
          accountSignatories: String(a.accountSignatories ?? "").trim(),
          sortOrder: a.sortOrder ?? idx,
        })),
      });
    });
    const updated = await prisma.entityBankAccount.findMany({
      where: { leadId },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ success: true, entityBankAccounts: updated });
  } catch (error: any) {
    console.error("Error replacing entity bank accounts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save bank accounts" },
      { status: 500 }
    );
  }
}

async function handleCreateLeadWithClient(data: any) {
  let leadId: string | null = null;
  let fineractClientId: number | null = null;

  try {
    // Step 1: Convert and validate data
    const processedData = {
      ...data,
      // Convert string IDs to numbers
      officeId: data.officeId ? Number(data.officeId) : undefined,
      legalFormId: data.legalFormId ? Number(data.legalFormId) : undefined,
      clientTypeId: data.clientTypeId ? Number(data.clientTypeId) : undefined,
      clientClassificationId: data.clientClassificationId
        ? Number(data.clientClassificationId)
        : undefined,
      genderId: data.genderId ? Number(data.genderId) : undefined,
      // Convert date strings to Date objects
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      submittedOnDate: data.submittedOnDate
        ? new Date(data.submittedOnDate)
        : new Date(),
      activationDate: data.activationDate
        ? new Date(data.activationDate)
        : undefined,
      // Convert savingsProductId to number if it exists
      savingsProductId: data.savingsProductId
        ? Number(data.savingsProductId)
        : undefined,
      // Convert monthlyDebtPayments to number if it exists
      monthlyDebtPayments: data.monthlyDebtPayments
        ? Number(data.monthlyDebtPayments)
        : undefined,
    };

    // Validate data
    const validatedData = clientFormSchema.parse(processedData);

    // Step 2: Create client in Fineract FIRST (outside transaction)
    const fineractService = await getFineractServiceWithSession();

    // Validate required fields for Fineract
    if (!validatedData.officeId) {
      throw new Error("Office ID is required for Fineract client creation");
    }
    if (!validatedData.legalFormId) {
      throw new Error("Legal Form ID is required for Fineract client creation");
    }
    const isEntityLead = validatedData.legalFormId === 2;
    if (!isEntityLead && (!validatedData.firstname || !validatedData.lastname)) {
      throw new Error(
        "First name and last name are required for Fineract client creation"
      );
    }
    if (isEntityLead && !validatedData.fullname) {
      throw new Error(
        "Business name is required for Fineract entity client creation"
      );
    }

    // Step 2a: Check if client already exists in Fineract by external ID (national ID)
    if (validatedData.externalId) {
      console.log("==========> Checking if client exists with external ID:", validatedData.externalId);
      try {
        const { fetchClientByExternalId } = await import("@/lib/api");
        const existingClient = await fetchClientByExternalId(validatedData.externalId);
        
        if (existingClient && existingClient.id) {
          console.log("==========> Client already exists in Fineract with ID:", existingClient.id);
          // Client already exists - return their info instead of creating a new one
          fineractClientId = existingClient.id;
          
          // Skip to creating the lead with the existing client data
          const result = await prisma.$transaction(async (tx) => {
            const session = await getSession();
            if (!session?.user?.id) {
              throw new Error("User not authenticated");
            }
            const userId = session.user.id;

            // Resolve current tenant from subdomain/headers
            const currentTenant = await resolveCurrentTenant(tx, _currentRequest);
            const tenantId = currentTenant.id;

            // Create lead in database with existing Fineract client data
            const newLead = await tx.lead.create({
              data: {
                userId,
                tenantId,
                officeId: validatedData.officeId,
                officeName: validatedData.officeName,
                legalFormId: validatedData.legalFormId,
                legalFormName: validatedData.legalFormName,
                externalId: validatedData.externalId,
                firstname: validatedData.firstname,
                middlename: validatedData.middlename,
                lastname: validatedData.lastname,
                dateOfBirth: validatedData.dateOfBirth || undefined,
                gender: validatedData.gender,
                genderId: validatedData.genderId || undefined,
                isStaff: validatedData.isStaff,
                mobileNo: validatedData.mobileNo,
                countryCode: validatedData.countryCode,
                emailAddress: validatedData.emailAddress,
                clientTypeId: validatedData.clientTypeId || undefined,
                clientTypeName: validatedData.clientTypeName,
                clientClassificationId: validatedData.clientClassificationId || undefined,
                clientClassificationName: validatedData.clientClassificationName,
                submittedOnDate: validatedData.submittedOnDate,
                active: validatedData.active,
                activationDate: validatedData.activationDate || undefined,
                openSavingsAccount: validatedData.openSavingsAccount,
                savingsProductId: validatedData.savingsProductId || undefined,
                savingsProductName: validatedData.savingsProductName,
                monthlyIncomeRange: validatedData.monthlyIncomeRange,
                employmentStatus: validatedData.employmentStatus,
                employerName: validatedData.employerName,
                yearsAtCurrentJob: validatedData.yearsAtCurrentJob,
                hasExistingLoans: validatedData.hasExistingLoans,
                monthlyDebtPayments: validatedData.monthlyDebtPayments,
                propertyOwnership: validatedData.propertyOwnership,
                businessOwnership: validatedData.businessOwnership,
                businessType: validatedData.businessType,
                businessAddress: validatedData.businessAddress,
                fineractClientId: existingClient.id,
                fineractAccountNo: existingClient.accountNo || null,
                clientCreatedInFineract: true,
                clientCreationDate: new Date(),
                status: "DRAFT",
                currentStep: 2,
              },
            });

            await persistEntityStructureDraftForLead(
              tx,
              newLead.id,
              validatedData.legalFormId,
              data
            );

            return {
              lead: newLead,
              fineractClient: existingClient,
              clientAlreadyExisted: true,
            };
          });

          return NextResponse.json({
            success: true,
            message: "Client already exists in Fineract. Lead created with existing client.",
            leadId: result.lead.id,
            fineractClientId: existingClient.id,
            fineractAccountNo: existingClient.accountNo || null,
            clientAlreadyExisted: true,
          });
        }
      } catch (lookupError: any) {
        // Client not found is expected - continue with creation
        if (!lookupError.message?.includes("not found")) {
          console.log("==========> Error checking for existing client:", lookupError.message);
        } else {
          console.log("==========> Client not found in Fineract, will create new client");
        }
      }
    }

    // Prepare client data for Fineract (entity vs individual)
    const clientData: Record<string, any> = {
      officeId: validatedData.officeId,
      legalFormId: validatedData.legalFormId,
      ...(validatedData.mobileNo && { mobileNo: validatedData.mobileNo }),
      ...(validatedData.emailAddress && { emailAddress: validatedData.emailAddress }),
      ...(validatedData.clientTypeId && { clientTypeId: validatedData.clientTypeId }),
      ...(validatedData.externalId && { externalId: validatedData.externalId }),
      active: validatedData.active || false,
      ...(validatedData.active && {
        activationDate:
          validatedData.activationDate?.toISOString().split("T")[0] ||
          new Date().toISOString().split("T")[0],
      }),
      dateFormat: "yyyy-MM-dd",
      locale: "en",
      submittedOnDate:
        validatedData.submittedOnDate?.toISOString().split("T")[0] ||
        new Date().toISOString().split("T")[0],
    };

    if (isEntityLead) {
      clientData.fullname = validatedData.fullname;
    } else {
      clientData.firstname = validatedData.firstname;
      clientData.lastname = validatedData.lastname;
      if (validatedData.middlename) clientData.middlename = validatedData.middlename;
      if (validatedData.dateOfBirth) clientData.dateOfBirth = formatDateForFineract(validatedData.dateOfBirth);
      if (validatedData.genderId) clientData.genderId = validatedData.genderId;
    }

    // Create client in Fineract
    console.log(
      "Creating client in Fineract with data:",
      JSON.stringify(clientData, null, 2)
    );
    const fineractClient = await fineractService.createClient(clientData);
    fineractClientId = fineractClient.clientId || fineractClient.resourceId;

    console.log("==========> Fineract client created successfully:");
    console.log("==========> Fineract response:", fineractClient);
    console.log("==========> Fineract client ID:", fineractClientId);
    console.log("==========> Fineract resource ID:", fineractClient.resourceId);

    // Step 3: Now create lead in database with Fineract data (inside transaction)
    const result = await prisma.$transaction(async (tx) => {
      // Get current user ID and tenant ID
      const session = await getSession();
      if (!session?.user?.id) {
        throw new Error("User not authenticated");
      }
      const userId = session.user.id;

      // Resolve current tenant from subdomain/headers
      const currentTenant = await resolveCurrentTenant(tx, _currentRequest);
      const tenantId = currentTenant.id;

      // Create lead in database with Fineract data
      const newLead = await tx.lead.create({
        data: {
          userId,
          tenantId,
          officeId: validatedData.officeId,
          officeName: validatedData.officeName,
          legalFormId: validatedData.legalFormId,
          legalFormName: validatedData.legalFormName,
          externalId: validatedData.externalId,
          firstname: validatedData.firstname,
          middlename: validatedData.middlename,
          lastname: validatedData.lastname,
          dateOfBirth: validatedData.dateOfBirth || undefined,
          gender: validatedData.gender,
          genderId: validatedData.genderId || undefined,
          fullname: validatedData.fullname,
          tradingName: validatedData.tradingName,
          registrationNumber: validatedData.registrationNumber,
          dateOfIncorporation: validatedData.dateOfIncorporation || undefined,
          natureOfBusiness: validatedData.natureOfBusiness,
          businessAddress: validatedData.businessAddress,
          isStaff: validatedData.isStaff,
          mobileNo: validatedData.mobileNo,
          countryCode: validatedData.countryCode,
          emailAddress: validatedData.emailAddress,
          clientTypeId: validatedData.clientTypeId || undefined,
          clientTypeName: validatedData.clientTypeName,
          clientClassificationId:
            validatedData.clientClassificationId || undefined,
          clientClassificationName: validatedData.clientClassificationName,
          submittedOnDate: validatedData.submittedOnDate,
          active: validatedData.active,
          activationDate: validatedData.activationDate || undefined,
          openSavingsAccount: validatedData.openSavingsAccount,
          savingsProductId: validatedData.savingsProductId || undefined,
          savingsProductName: validatedData.savingsProductName,
          // Financial fields
          monthlyIncomeRange: validatedData.monthlyIncomeRange,
          employmentStatus: validatedData.employmentStatus,
          employerName: validatedData.employerName,
          yearsAtCurrentJob: validatedData.yearsAtCurrentJob,
          hasExistingLoans: validatedData.hasExistingLoans,
          monthlyDebtPayments: validatedData.monthlyDebtPayments,
          propertyOwnership: validatedData.propertyOwnership,
          businessOwnership: validatedData.businessOwnership,
          businessType: validatedData.businessType,
          // Fineract data
          fineractClientId:
            fineractClient.clientId || fineractClient.resourceId,
          fineractAccountNo: fineractClient.resourceExternalId || null,
          clientCreatedInFineract: true,
          clientCreationDate: new Date(),
          status: "DRAFT",
          currentStep: 2,
        },
      });

      await persistEntityStructureDraftForLead(
        tx,
        newLead.id,
        validatedData.legalFormId,
        data
      );

      leadId = newLead.id;

      console.log("==========> Lead created successfully:");
      console.log("==========> Lead ID:", newLead.id);
      console.log(
        "==========> Stored fineractClientId:",
        newLead.fineractClientId
      );
      console.log(
        "==========> Stored fineractAccountNo:",
        newLead.fineractAccountNo
      );
      console.log(
        "==========> Source fineractClient.clientId:",
        fineractClient.clientId
      );
      console.log(
        "==========> Source fineractClient.resourceId:",
        fineractClient.resourceId
      );

      return {
        lead: newLead,
        fineractClient,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Lead and client created successfully",
      leadId: result.lead.id,
      fineractClientId:
        result.fineractClient.clientId || result.fineractClient.resourceId,
      fineractAccountNo: result.fineractClient.resourceExternalId || null,
    });
  } catch (error: any) {
    console.error("Error in transactional lead creation:", error);

    // If we have a Fineract client but lead creation failed, delete the Fineract client
    if (fineractClientId && !leadId) {
      try {
        console.log(
          `Cleaning up Fineract client ${fineractClientId} after lead creation failure`
        );
        const fineractService = await getFineractServiceWithSession();
        await fineractService.deleteClient(fineractClientId);
        console.log(
          `Successfully cleaned up Fineract client ${fineractClientId}`
        );
      } catch (cleanupError) {
        console.error(
          "Failed to clean up Fineract client after error:",
          cleanupError
        );
        console.warn(
          `Fineract client ${fineractClientId} was created but lead creation failed and cleanup failed. Manual cleanup may be required.`
        );
      }
    }

    // If we have a leadId, try to clean up by deleting the lead
    if (leadId) {
      try {
        await prisma.lead.delete({
          where: { id: leadId },
        });
        console.log("Cleaned up lead after creation failure");
      } catch (cleanupError) {
        console.error("Failed to clean up lead after error:", cleanupError);
      }
    }

    // Determine if this is a Fineract-specific error and provide specific error messages
    const isFineractError =
      error.response?.data || error.message?.includes("Fineract");
    let errorMessage = error.message || "Failed to create lead and client";

    // Clarify when the error is from the Fineract backend's database (not Loan Matrix .env)
    if (
      error.message?.includes("database server") &&
      error.message?.includes("credentials for")
    ) {
      errorMessage =
        "The Fineract/Mifos backend (" +
        (process.env.FINERACT_BASE_URL || "mifos-be") +
        ") could not connect to its database. Update the database credentials on the Fineract server (host 10.10.0.143:5432, user postgres), not in Loan Matrix .env.";
    } else if (isFineractError) {
      const fineractError = error.response?.data;
      if (fineractError?.errors && Array.isArray(fineractError.errors)) {
        // Extract specific validation errors from Fineract
        const validationErrors = fineractError.errors
          .map(
            (err: any) =>
              err.defaultUserMessage ||
              err.developerMessage ||
              err.message ||
              "Validation error"
          )
          .join(", ");
        errorMessage = `Fineract validation error: ${validationErrors}`;
      } else if (fineractError?.defaultUserMessage) {
        errorMessage = `Fineract error: ${fineractError.defaultUserMessage}`;
      } else if (error.response?.status === 400) {
        errorMessage =
          "Fineract validation error: Please check that all required fields are filled correctly";
      } else if (error.response?.status === 401) {
        errorMessage =
          "Fineract authentication error: Please check your Fineract credentials";
      } else if (error.response?.status === 403) {
        errorMessage =
          "Fineract permission error: You don't have permission to create clients";
      } else if (error.response?.status === 404) {
        errorMessage =
          "Fineract resource not found: Office or Legal Form may not exist";
      } else {
        errorMessage =
          "Failed to create client in Fineract. Please check your Fineract connection and try again.";
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error.response?.data || null,
        leadId: leadId, // Return leadId for debugging
        fineractClientId: fineractClientId, // Return fineractClientId for debugging
        isFineractError,
      },
      { status: 500 }
    );
  }
}

async function handleCreateClientInFineract(leadId: string) {
  try {
    // Get the lead data
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Check if client already exists in Fineract
    if (lead.clientCreatedInFineract && lead.fineractClientId) {
      return NextResponse.json({
        success: true,
        message: "Client already exists in Fineract",
        fineractClientId: lead.fineractClientId,
        fineractAccountNo: lead.fineractAccountNo,
      });
    }

    // Prepare client data for Fineract (entity vs individual)
    const isEntitySubmit = lead.legalFormId === 2;
    const clientData: Record<string, any> = {
      officeId: lead.officeId,
      legalFormId: lead.legalFormId,
      mobileNo: lead.mobileNo,
      ...(lead.emailAddress && { emailAddress: lead.emailAddress }),
      clientTypeId: lead.clientTypeId,
      ...(lead.externalId && { externalId: lead.externalId }),
      active: lead.active || false,
      ...(lead.active && {
        activationDate: lead.activationDate
          ? formatDateForFineract(lead.activationDate)
          : undefined,
      }),
      dateFormat: "yyyy-MM-dd",
      locale: "en",
      submittedOnDate: lead.submittedOnDate
        ? formatDateForFineract(lead.submittedOnDate)
        : undefined,
    };

    if (isEntitySubmit) {
      clientData.fullname = lead.fullname;
    } else {
      clientData.fullname = `${lead.firstname} ${lead.lastname}`;
      clientData.firstname = lead.firstname;
      clientData.lastname = lead.lastname;
      if (lead.middlename) clientData.middlename = lead.middlename;
      if (lead.dateOfBirth) clientData.dateOfBirth = formatDateForFineract(lead.dateOfBirth);
      if (lead.genderId) clientData.genderId = lead.genderId;
    }

    // Create client in Fineract
    const fineractService = await getFineractServiceWithSession();
    const fineractClient = await fineractService.createClient(clientData);

    // Update lead with Fineract client information
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        fineractClientId: fineractClient.id,
        fineractAccountNo: fineractClient.accountNo,
        clientCreatedInFineract: true,
        clientCreationDate: new Date(),
        currentStep: 2, // Move to next step after client creation
      },
    });

    return NextResponse.json({
      success: true,
      message: "Client created successfully in Fineract",
      fineractClientId: fineractClient.id,
      fineractAccountNo: fineractClient.accountNo,
    });
  } catch (error: any) {
    console.error("Error creating client in Fineract:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to create client in Fineract",
        details: error.response?.data || null,
      },
      { status: 500 }
    );
  }
}

// Handle updating an existing client in both Fineract and local database
async function handleUpdateClient(data: any, leadId?: string) {
  try {
    console.log("==========> Starting transactional client update");
    console.log("Update data:", data);
    console.log("Lead ID:", leadId);
    console.log("==========> Data type:", typeof data);
    console.log("==========> Data keys:", Object.keys(data || {}));

    // Validate required fields
    if (!data.fineractClientId) {
      console.error("==========> Missing fineractClientId");
      throw new Error("Fineract client ID is required for update");
    }

    const isEntityUpdate = data.legalFormId === 2;

    if (!isEntityUpdate && !data.externalId) {
      console.error("==========> Missing externalId");
      throw new Error("External ID is required for update");
    }

    if (!isEntityUpdate && !data.firstname) {
      console.error("==========> Missing firstname");
      throw new Error("First name is required for update");
    }

    if (!isEntityUpdate && !data.lastname) {
      console.error("==========> Missing lastname");
      throw new Error("Last name is required for update");
    }

    if (isEntityUpdate && !data.fullname) {
      console.error("==========> Missing fullname for entity");
      throw new Error("Business name is required for entity update");
    }

    console.log("==========> All required fields validated successfully");

    // Step 1: Update client in Fineract
    console.log("==========> Getting Fineract service...");
    const fineractService = await getFineractServiceWithSession();
    console.log("==========> Fineract service obtained successfully");

    // Debug date fields before formatting
    console.log("==========> Date field types:");
    console.log(
      "dateOfBirth type:",
      typeof data.dateOfBirth,
      "value:",
      data.dateOfBirth
    );
    console.log(
      "submittedOnDate type:",
      typeof data.submittedOnDate,
      "value:",
      data.submittedOnDate
    );
    console.log(
      "activationDate type:",
      typeof data.activationDate,
      "value:",
      data.activationDate
    );

    // Format account number with leading zeros (9 digits total)
    const formatAccountNumber = (
      accountNo: string | number | null | undefined
    ): string | undefined => {
      if (!accountNo) return undefined;
      const accountStr = accountNo.toString();
      return accountStr.padStart(9, "0");
    };

    const fineractUpdateData: Record<string, any> = {
      legalFormId: data.legalFormId,
      isStaff: data.isStaff || false,
      active: data.active !== false,
      externalId: data.externalId,
      mobileNo: data.mobileNo,
      emailAddress: data.emailAddress,
      submittedOnDate: data.submittedOnDate
        ? formatDateForFineract(data.submittedOnDate)
        : undefined,
      activationDate: data.activationDate
        ? formatDateForFineract(data.activationDate)
        : undefined,
      ...(data.clientTypeId && { clientTypeId: data.clientTypeId }),
      ...(data.fineractAccountNo && {
        accountNo: formatAccountNumber(data.fineractAccountNo),
      }),
      dateFormat: "yyyy-MM-dd",
      locale: "en",
      clientNonPersonDetails: {},
    };

    if (isEntityUpdate) {
      fineractUpdateData.fullname = data.fullname;
    } else {
      fineractUpdateData.firstname = data.firstname;
      fineractUpdateData.middlename = data.middlename;
      fineractUpdateData.lastname = data.lastname;
      if (data.dateOfBirth) fineractUpdateData.dateOfBirth = formatDateForFineract(data.dateOfBirth);
      if (data.genderId) fineractUpdateData.genderId = data.genderId;
    }

    console.log("==========> DEBUG: Fineract Update Payload:");
    console.log(
      "==========> Raw data.fineractAccountNo:",
      data.fineractAccountNo
    );
    console.log("==========> Raw data.genderId:", data.genderId);
    console.log("==========> Raw data.clientTypeId:", data.clientTypeId);
    console.log(
      "==========> Formatted accountNo:",
      formatAccountNumber(data.fineractAccountNo)
    );
    console.log(
      "==========> Full Fineract payload:",
      JSON.stringify(fineractUpdateData, null, 2)
    );

    // Update client in Fineract
    let updatedFineractClient;
    try {
      console.log("==========> Calling fineractService.updateClient...");
      updatedFineractClient = await fineractService.updateClient(
        data.fineractClientId,
        fineractUpdateData
      );
      console.log(
        "==========> Fineract client updated successfully:",
        updatedFineractClient
      );
    } catch (fineractError: any) {
      console.error("==========> Fineract update error:", fineractError);
      console.error(
        "==========> Fineract error response:",
        fineractError.response?.data
      );
      console.error(
        "==========> Fineract error status:",
        fineractError.response?.status
      );
      throw fineractError;
    }

    // Step 2: Update existing lead or create new one
    let result;
    try {
      if (leadId) {
        // UPDATE existing lead
        console.log("==========> Updating existing lead with ID:", leadId);
        result = await prisma.$transaction(async (tx) => {
          // Update the existing lead record
          const updatedLead = await tx.lead.update({
            where: { id: leadId },
            data: {
              // Client identification
              externalId: data.externalId,
              fineractClientId: data.fineractClientId,
              fineractAccountNo: updatedFineractClient.accountNo,

              // Office information
              officeId: data.officeId,
              officeName: data.officeName,

              // Legal form information
              legalFormId: data.legalFormId,
              legalFormName: data.legalFormName,

              // Personal information
              firstname: data.firstname,
              middlename: data.middlename,
              lastname: data.lastname,
              dateOfBirth: data.dateOfBirth
                ? new Date(data.dateOfBirth)
                : undefined,
              gender: data.gender,
              genderId: data.genderId,

              // Entity information
              fullname: data.fullname,
              tradingName: data.tradingName,
              registrationNumber: data.registrationNumber,
              dateOfIncorporation: data.dateOfIncorporation
                ? new Date(data.dateOfIncorporation)
                : undefined,
              natureOfBusiness: data.natureOfBusiness,
              businessAddress: data.businessAddress,

              isStaff: data.isStaff || false,

              // Contact information
              mobileNo: data.mobileNo,
              countryCode: data.countryCode || "+263",
              emailAddress: data.emailAddress,

              // Client classification
              clientTypeId: data.clientTypeId,
              clientTypeName: data.clientTypeName,
              clientClassificationId: data.clientClassificationId,
              clientClassificationName: data.clientClassificationName,

              // Dates
              submittedOnDate: data.submittedOnDate
                ? new Date(data.submittedOnDate)
                : undefined,
              activationDate: data.activationDate
                ? new Date(data.activationDate)
                : undefined,

              // Status and flags
              active: data.active !== false,
              openSavingsAccount: data.openSavingsAccount || false,
              status: "ACTIVE",

              // Timestamps
              lastModified: new Date(),
              updatedAt: new Date(),
            },
          });

          console.log("==========> Lead updated successfully:", updatedLead.id);
          return updatedLead;
        });
        console.log("==========> Existing lead updated successfully");
      } else {
        // CREATE new lead (fallback for backward compatibility)
        console.log("==========> No leadId provided, creating new lead...");
        result = await prisma.$transaction(async (tx) => {
          // Resolve current tenant from subdomain/headers
          const currentTenant = await resolveCurrentTenant(tx, _currentRequest);

          // Get current user ID from session
          const session = await getSession();
          if (!session?.user?.id) {
            throw new Error("User not authenticated");
          }
          const userId = session.user.id;

          // Create a new lead record
          const newLead = await tx.lead.create({
            data: {
              // User and tenant identification
              userId: userId,
              tenantId: currentTenant.id,

              // Client identification
              externalId: data.externalId,
              fineractClientId: data.fineractClientId,
              fineractAccountNo: updatedFineractClient.accountNo,

              // Office information
              officeId: data.officeId,
              officeName: data.officeName,

              // Legal form information
              legalFormId: data.legalFormId,
              legalFormName: data.legalFormName,

              // Personal information
              firstname: data.firstname,
              middlename: data.middlename,
              lastname: data.lastname,
              dateOfBirth: data.dateOfBirth
                ? new Date(data.dateOfBirth)
                : undefined,
              gender: data.gender,
              genderId: data.genderId,

              // Entity information
              fullname: data.fullname,
              tradingName: data.tradingName,
              registrationNumber: data.registrationNumber,
              dateOfIncorporation: data.dateOfIncorporation
                ? new Date(data.dateOfIncorporation)
                : undefined,
              natureOfBusiness: data.natureOfBusiness,
              businessAddress: data.businessAddress,

              isStaff: data.isStaff || false,

              // Contact information
              mobileNo: data.mobileNo,
              countryCode: data.countryCode || "+263",
              emailAddress: data.emailAddress,

              // Client classification
              clientTypeId: data.clientTypeId,
              clientTypeName: data.clientTypeName,
              clientClassificationId: data.clientClassificationId,
              clientClassificationName: data.clientClassificationName,

              // Dates
              submittedOnDate: data.submittedOnDate
                ? new Date(data.submittedOnDate)
                : new Date(),
              activationDate: data.activationDate
                ? new Date(data.activationDate)
                : new Date(),

              // Status and flags
              active: data.active !== false,
              openSavingsAccount: data.openSavingsAccount || false,
              status: "ACTIVE",
              currentStep: 1,

              // Timestamps
              lastModified: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          await persistEntityStructureDraftForLead(
            tx,
            newLead.id,
            Number(data.legalFormId),
            data
          );

          console.log("==========> New lead created successfully:", newLead.id);
          return newLead;
        });
        console.log("==========> New lead created successfully");
      }
    } catch (prismaError: any) {
      console.error("==========> Prisma transaction error:", prismaError);
      console.error("==========> Prisma error details:", prismaError.message);
      throw prismaError;
    }

    return NextResponse.json({
      success: true,
      message: leadId
        ? "Client and lead updated successfully"
        : "Client updated in Fineract and new lead created in local database",
      fineractClientId: data.fineractClientId,
      fineractAccountNo: formatAccountNumber(data.fineractAccountNo),
      leadId: result.id,
    });
  } catch (error: any) {
    console.error("Error in transactional client update:", error);

    // Parse Fineract-specific errors
    if (error.response?.data) {
      const fineractError = error.response.data;
      let errorMessage = "Failed to update client in Fineract";

      if (fineractError.errors) {
        const validationErrors = fineractError.errors
          .map((err: any) => err.defaultUserMessage || err.developerMessage)
          .join(", ");
        errorMessage = `Fineract validation error: ${validationErrors}`;
      } else if (fineractError.developerMessage) {
        errorMessage = `Fineract error: ${fineractError.developerMessage}`;
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: fineractError,
        },
        { status: error.response.status || 500 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || "Failed to update client",
        details: error.response?.data || null,
      },
      { status: 500 }
    );
  }
}
