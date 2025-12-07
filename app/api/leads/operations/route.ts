import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { getSession } from "@/lib/auth";

// Helper function to format dates for Fineract API
const formatDateForFineract = (
  date: Date | string | null | undefined
): string => {
  // Handle null, undefined, or empty values
  if (!date) {
    return new Date().toISOString().split("T")[0];
  }

  // Convert string to Date if needed
  let dateObj: Date;
  if (typeof date === "string") {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
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

// Client form schema
const clientFormSchema = z.object({
  officeId: z.number(),
  officeName: z.string().optional(),
  legalFormId: z.number(),
  legalFormName: z.string().optional(),
  externalId: z.string(),
  firstname: z.string(),
  middlename: z.string().optional(),
  lastname: z.string(),
  dateOfBirth: z.date().optional(),
  gender: z.string().optional(),
  genderId: z.number().optional(),
  isStaff: z.boolean().default(false),
  mobileNo: z.string(),
  countryCode: z.string().default("+1"),
  emailAddress: z.string().email(),
  clientTypeId: z.number().optional(),
  clientTypeName: z.string().optional(),
  clientClassificationId: z.number().optional(),
  clientClassificationName: z.string().optional(),
  submittedOnDate: z.date().default(() => new Date()),
  active: z.boolean().default(true),
  activationDate: z.date().optional(),
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

/**
 * POST /api/leads/operations
 * Handles lead operations like save draft, submit, etc.
 */
export async function POST(request: Request) {
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

    // Get the default tenant ID
    const defaultTenant = await prisma.tenant.findUnique({
      where: { slug: "goodfellow" },
    });

    if (!defaultTenant) {
      throw new Error("Default tenant not found. Please run database seed.");
    }

    const tenantId = defaultTenant.id;

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
    if (!validatedData.firstname || !validatedData.lastname) {
      throw new Error(
        "First name and last name are required for Fineract client creation"
      );
    }

    // Prepare client data for Fineract
    const clientData = {
      officeId: validatedData.officeId,
      legalFormId: validatedData.legalFormId,
      firstname: validatedData.firstname,
      lastname: validatedData.lastname,
      ...(validatedData.middlename && {
        middlename: validatedData.middlename,
      }),
      ...(validatedData.mobileNo && {
        mobileNo: validatedData.mobileNo,
      }),
      ...(validatedData.emailAddress && {
        emailAddress: validatedData.emailAddress,
      }),
      ...(validatedData.dateOfBirth && {
        dateOfBirth: formatDateForFineract(validatedData.dateOfBirth),
      }),
      ...(validatedData.clientTypeId && {
        clientTypeId: validatedData.clientTypeId,
      }),
      ...(validatedData.genderId && {
        genderId: validatedData.genderId,
      }),
      ...(validatedData.externalId && {
        externalId: validatedData.externalId,
      }),
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

      // Get the default tenant ID
      const defaultTenant = await tx.tenant.findUnique({
        where: { slug: "goodfellow" },
      });

      if (!defaultTenant) {
        throw new Error("Default tenant not found. Please run database seed.");
      }

      const tenantId = defaultTenant.id;

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
          status: "DRAFT", // Set to DRAFT after successful creation
          currentStep: 2, // Move to next step after client creation
        },
      });

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

    if (isFineractError) {
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

    // Prepare client data for Fineract
    const clientData = {
      officeId: lead.officeId,
      legalFormId: lead.legalFormId,
      fullname: `${lead.firstname} ${lead.lastname}`,
      firstname: lead.firstname,
      lastname: lead.lastname,
      ...(lead.middlename && { middlename: lead.middlename }),
      mobileNo: lead.mobileNo,
      emailAddress: lead.emailAddress,
      dateOfBirth: lead.dateOfBirth
        ? formatDateForFineract(lead.dateOfBirth)
        : undefined,
      clientTypeId: lead.clientTypeId,
      genderId: lead.genderId,
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

    if (!data.externalId) {
      console.error("==========> Missing externalId");
      throw new Error("External ID is required for update");
    }

    if (!data.firstname) {
      console.error("==========> Missing firstname");
      throw new Error("First name is required for update");
    }

    if (!data.lastname) {
      console.error("==========> Missing lastname");
      throw new Error("Last name is required for update");
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

    const fineractUpdateData = {
      legalFormId: data.legalFormId,
      isStaff: data.isStaff || false,
      active: data.active !== false,
      externalId: data.externalId,
      mobileNo: data.mobileNo,
      emailAddress: data.emailAddress,
      firstname: data.firstname,
      middlename: data.middlename,
      lastname: data.lastname,
      dateOfBirth: data.dateOfBirth
        ? formatDateForFineract(data.dateOfBirth)
        : undefined,
      submittedOnDate: data.submittedOnDate
        ? formatDateForFineract(data.submittedOnDate)
        : undefined,
      activationDate: data.activationDate
        ? formatDateForFineract(data.activationDate)
        : undefined,
      ...(data.genderId && { genderId: data.genderId }),
      ...(data.clientTypeId && { clientTypeId: data.clientTypeId }),
      ...(data.fineractAccountNo && {
        accountNo: formatAccountNumber(data.fineractAccountNo),
      }),
      dateFormat: "yyyy-MM-dd",
      locale: "en",
      clientNonPersonDetails: {},
    };

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
          // Get the default tenant for the lead
          const defaultTenant = await tx.tenant.findUnique({
            where: { slug: "goodfellow" },
          });

          if (!defaultTenant) {
            throw new Error(
              "Default tenant not found. Please run database seed."
            );
          }

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
              tenantId: defaultTenant.id,

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
