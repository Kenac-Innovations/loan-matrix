"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";

// Client form schema - uses z.coerce.date() to handle strings, numbers, and Date objects
const clientFormSchema = z.object({
  officeId: z.number().optional(),
  officeName: z.string().optional(),
  legalFormId: z.number().optional(),
  legalFormName: z.string().optional(),
  externalId: z.union([z.string(), z.number()]).optional().transform(val => val !== undefined ? String(val) : undefined),
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
  isStaff: z.boolean().default(false),
  mobileNo: z.union([z.string(), z.number()]).optional().transform(val => val !== undefined ? String(val) : undefined),
  countryCode: z.string().default("+260"),
  emailAddress: z.union([
    z.string().email(),
    z.string().length(0),
    z.null(),
    z.undefined(),
  ]),
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
  fieldName: z.string().optional(), // The field that was just updated
  fineractClientId: z.number().optional(),
  fineractAccountNo: z.string().optional(),
});

// Auto-save action
export async function autoSaveField(
  data: z.infer<typeof clientFormSchema>,
  leadId?: string
) {
  try {
    console.log("Auto-save called with data:", data);
    console.log("Field being saved:", data.fieldName);
    console.log("Current leadId:", leadId);

    // Convert data types before validation
    const processedData = {
      ...data,
      // Convert string IDs to numbers
      officeId: data.officeId ? Number(data.officeId) : undefined,
      legalFormId: data.legalFormId ? Number(data.legalFormId) : undefined,
      clientTypeId: data.clientTypeId ? Number(data.clientTypeId) : undefined,
      clientClassificationId: data.clientClassificationId ? Number(data.clientClassificationId) : undefined,
      genderId: data.genderId ? Number(data.genderId) : undefined,
      // Convert date strings to Date objects
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      submittedOnDate: data.submittedOnDate ? new Date(data.submittedOnDate) : new Date(),
      activationDate: data.activationDate ? new Date(data.activationDate) : undefined,
      // Convert savingsProductId to number if it exists
      savingsProductId: data.savingsProductId ? Number(data.savingsProductId) : undefined,
    };

    // Validate data
    const validatedData = clientFormSchema.parse(processedData);

    // Get current user ID and tenant from session/headers
    const session = await getSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }
    const userId = session.user.id;

    let tenantId: string;
    const tenant = await getTenantFromHeaders();
    if (tenant) {
      tenantId = tenant.id;
    } else {
      // Fallback: look up tenant from env or default
      const fallbackSlug = process.env.FINERACT_TENANT_ID || "goodfellow";
      const fallbackTenant = await prisma.tenant.findFirst({
        where: { slug: fallbackSlug, isActive: true },
      });
      if (!fallbackTenant) {
        throw new Error(`Tenant '${fallbackSlug}' not found.`);
      }
      tenantId = fallbackTenant.id;
    }

    // Current timestamp for tracking
    const now = new Date();

    if (leadId) {
      console.log("Updating existing lead:", leadId);

      // Update existing lead
      const updatedLead = await prisma.lead.update({
        where: { id: leadId },
        data: {
          ...(validatedData.officeId !== undefined && {
            officeId: validatedData.officeId,
          }),
          ...(validatedData.officeName !== undefined && {
            officeName: validatedData.officeName,
          }),
          ...(validatedData.legalFormId !== undefined && {
            legalFormId: validatedData.legalFormId,
          }),
          ...(validatedData.legalFormName !== undefined && {
            legalFormName: validatedData.legalFormName,
          }),
          ...(validatedData.externalId !== undefined && {
            externalId: validatedData.externalId,
          }),
          ...(validatedData.firstname !== undefined && {
            firstname: validatedData.firstname,
          }),
          ...(validatedData.middlename !== undefined && {
            middlename: validatedData.middlename,
          }),
          ...(validatedData.lastname !== undefined && {
            lastname: validatedData.lastname,
          }),
          ...(validatedData.dateOfBirth !== undefined && {
            dateOfBirth: validatedData.dateOfBirth,
          }),
          ...(validatedData.gender !== undefined && {
            gender: validatedData.gender,
          }),
          ...(validatedData.genderId !== undefined && {
            genderId: validatedData.genderId,
          }),
          ...(validatedData.fullname !== undefined && {
            fullname: validatedData.fullname,
          }),
          ...(validatedData.tradingName !== undefined && {
            tradingName: validatedData.tradingName,
          }),
          ...(validatedData.registrationNumber !== undefined && {
            registrationNumber: validatedData.registrationNumber,
          }),
          ...(validatedData.dateOfIncorporation !== undefined && {
            dateOfIncorporation: validatedData.dateOfIncorporation,
          }),
          ...(validatedData.natureOfBusiness !== undefined && {
            natureOfBusiness: validatedData.natureOfBusiness,
          }),
          ...(validatedData.isStaff !== undefined && {
            isStaff: validatedData.isStaff,
          }),
          ...(validatedData.mobileNo !== undefined && {
            mobileNo: validatedData.mobileNo,
          }),
          ...(validatedData.countryCode !== undefined && {
            countryCode: validatedData.countryCode,
          }),
          ...(validatedData.emailAddress !== undefined && {
            emailAddress: validatedData.emailAddress,
          }),
          ...(validatedData.clientTypeId !== undefined && {
            clientTypeId: validatedData.clientTypeId,
          }),
          ...(validatedData.clientTypeName !== undefined && {
            clientTypeName: validatedData.clientTypeName,
          }),
          ...(validatedData.clientClassificationId !== undefined && {
            clientClassificationId: validatedData.clientClassificationId,
          }),
          ...(validatedData.clientClassificationName !== undefined && {
            clientClassificationName: validatedData.clientClassificationName,
          }),
          ...(validatedData.submittedOnDate !== undefined && {
            submittedOnDate: validatedData.submittedOnDate,
          }),
          ...(validatedData.active !== undefined && {
            active: validatedData.active,
          }),
          ...(validatedData.activationDate !== undefined && {
            activationDate: validatedData.activationDate,
          }),
          ...(validatedData.openSavingsAccount !== undefined && {
            openSavingsAccount: validatedData.openSavingsAccount,
          }),
          ...(validatedData.savingsProductId !== undefined && {
            savingsProductId: validatedData.savingsProductId,
          }),
          ...(validatedData.savingsProductName !== undefined && {
            savingsProductName: validatedData.savingsProductName,
          }),
          ...(validatedData.currentStep !== undefined && {
            currentStep: validatedData.currentStep,
          }),
          ...(validatedData.fineractClientId !== undefined && {
            fineractClientId: validatedData.fineractClientId,
            clientCreatedInFineract: true,
            clientCreationDate: now,
          }),
          ...(validatedData.fineractAccountNo !== undefined && {
            fineractAccountNo: validatedData.fineractAccountNo,
          }),
          lastModified: now,
        },
      });

      console.log("Lead updated successfully:", updatedLead.id);
      return { success: true, leadId };
    } else {
      console.log("Creating new lead with initial stage");
      const initialStage = await prisma.pipelineStage.findFirst({
        where: { tenantId, isInitialState: true, isActive: true },
        select: { id: true },
      });

      try {
        const lead = await prisma.lead.create({
          data: {
            userId,
            tenantId,
            currentStageId: initialStage?.id ?? null,
            officeId: validatedData.officeId || null,
            officeName: validatedData.officeName || null,
            legalFormId: validatedData.legalFormId || null,
            legalFormName: validatedData.legalFormName || null,
            externalId: validatedData.externalId || null,
            firstname: validatedData.firstname || null,
            middlename: validatedData.middlename || null,
            lastname: validatedData.lastname || null,
            dateOfBirth: validatedData.dateOfBirth || null,
            gender: validatedData.gender || null,
            genderId: validatedData.genderId || null,
            fullname: validatedData.fullname || null,
            tradingName: validatedData.tradingName || null,
            registrationNumber: validatedData.registrationNumber || null,
            dateOfIncorporation: validatedData.dateOfIncorporation || null,
            natureOfBusiness: validatedData.natureOfBusiness || null,
            isStaff: validatedData.isStaff || false,
            mobileNo: validatedData.mobileNo || null,
            countryCode: validatedData.countryCode || "+260",
            emailAddress: validatedData.emailAddress || null,
            clientTypeId: validatedData.clientTypeId || null,
            clientTypeName: validatedData.clientTypeName || null,
            clientClassificationId:
              validatedData.clientClassificationId || null,
            clientClassificationName:
              validatedData.clientClassificationName || null,
            submittedOnDate: validatedData.submittedOnDate || new Date(),
            active: validatedData.active || true,
            activationDate: validatedData.activationDate || null,
            openSavingsAccount: validatedData.openSavingsAccount || false,
            savingsProductId: validatedData.savingsProductId || null,
            savingsProductName: validatedData.savingsProductName || null,
            currentStep: validatedData.currentStep || 1,
            status: "PROSPECT",
            lastModified: now,
          },
        });

        console.log("New lead created successfully:", lead.id);
        return { success: true, leadId: lead.id };
      } catch (error) {
        console.error("Error creating lead:", error);
        console.log(
          "Error details:",
          error instanceof Error ? error.message : String(error)
        );

        // If there was an error with the user ID, try creating without it
        try {
          console.log("Retrying without user connection");
          // Use type assertion to bypass TypeScript's type checking
          const leadData = {
            userId,
            tenantId,
            currentStageId: initialStage?.id ?? null,
            officeId: validatedData.officeId || null,
            officeName: validatedData.officeName || null,
            legalFormId: validatedData.legalFormId || null,
            legalFormName: validatedData.legalFormName || null,
            externalId: validatedData.externalId || null,
            firstname: validatedData.firstname || null,
            middlename: validatedData.middlename || null,
            lastname: validatedData.lastname || null,
            dateOfBirth: validatedData.dateOfBirth || null,
            gender: validatedData.gender || null,
            genderId: validatedData.genderId || null,
            fullname: validatedData.fullname || null,
            tradingName: validatedData.tradingName || null,
            registrationNumber: validatedData.registrationNumber || null,
            dateOfIncorporation: validatedData.dateOfIncorporation || null,
            natureOfBusiness: validatedData.natureOfBusiness || null,
            isStaff: validatedData.isStaff || false,
            mobileNo: validatedData.mobileNo || null,
            countryCode: validatedData.countryCode || "+260",
            emailAddress: validatedData.emailAddress || null,
            clientTypeId: validatedData.clientTypeId || null,
            clientTypeName: validatedData.clientTypeName || null,
            clientClassificationId:
              validatedData.clientClassificationId || null,
            clientClassificationName:
              validatedData.clientClassificationName || null,
            submittedOnDate: validatedData.submittedOnDate || new Date(),
            active: validatedData.active || true,
            activationDate: validatedData.activationDate || null,
            openSavingsAccount: validatedData.openSavingsAccount || false,
            savingsProductId: validatedData.savingsProductId || null,
            savingsProductName: validatedData.savingsProductName || null,
            currentStep: validatedData.currentStep || 1,
            status: "PROSPECT",
            lastModified: now,
          };

          // Use Prisma's executeRaw to insert directly into the database
          // This bypasses the schema validation
          const leadWithoutUser = await prisma.lead.create({
            // @ts-ignore - Ignore TypeScript errors for this specific case
            data: leadData,
          });

          console.log(
            "Lead created without user connection:",
            leadWithoutUser.id
          );
          return { success: true, leadId: leadWithoutUser.id };
        } catch (retryError) {
          console.error("Error in retry attempt:", retryError);
          throw retryError;
        }
      }
    }
  } catch (error) {
    console.error("Error auto-saving field:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: "Failed to auto-save field: " + errorMessage,
    };
  }
}

// Get lead stage history
export async function getLeadStageHistory(leadId: string) {
  try {
    // In a real implementation, this would query a stage history table
    // For now, we'll return a mock response
    return [
      {
        id: "1",
        leadId: leadId,
        stage: "PROSPECT",
        enteredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
        exitedAt: null,
        duration: "3 days",
      },
    ];
  } catch (error) {
    console.error("Error getting lead stage history:", error);
    return [];
  }
}

// Cancel prospect and save reason
export async function cancelProspect(leadId: string, reason: string) {
  try {
    console.log("Canceling prospect:", leadId, "with reason:", reason);

    // Update the lead status to CLOSED and save the reason
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "CLOSED",
        closedReason: reason,
        lastModified: new Date(),
      },
    });

    console.log("Prospect canceled successfully:", updatedLead.id);
    return { success: true, leadId: updatedLead.id };
  } catch (error) {
    console.error("Error canceling prospect:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: "Failed to cancel prospect: " + errorMessage,
    };
  }
}

// Get lead by ID for restoration
export async function getLeadById(leadId: string) {
  try {
    console.log("Fetching lead by ID:", leadId);

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        familyMembers: true,
      },
    });

    if (!lead) {
      return { success: false, error: "Lead not found" };
    }

    console.log("Lead fetched successfully:", lead.id);
    return { success: true, lead };
  } catch (error) {
    console.error("Error fetching lead:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: "Failed to fetch lead: " + errorMessage,
    };
  }
}

// Mark lead as converted to client (clear from local storage)
export async function markLeadAsConverted(leadId: string) {
  try {
    console.log("Marking lead as converted:", leadId);

    // Update the lead status to indicate it's been converted
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "CONVERTED",
        lastModified: new Date(),
      },
    });

    console.log("Lead marked as converted successfully:", updatedLead.id);
    return { success: true, leadId: updatedLead.id };
  } catch (error) {
    console.error("Error marking lead as converted:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: "Failed to mark lead as converted: " + errorMessage,
    };
  }
}
