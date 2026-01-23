"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getOrCreateDefaultTenant } from "@/lib/tenant-service";
import { fetchFineractAPI } from "@/lib/api";

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
});

// Family member schema
const familyMemberSchema = z.object({
  firstname: z.string(),
  lastname: z.string(),
  middlename: z.string().optional(),
  relationship: z.string(),
  dateOfBirth: z.date().optional(),
  mobileNo: z.string().optional(),
  emailAddress: z.string().email().optional(),
  isDependent: z.boolean().default(false),
});

// Save draft action
export async function saveDraft(
  data: z.infer<typeof clientFormSchema>,
  leadId?: string
) {
  try {
    console.log("==========> saveDraft called with data:", data);
    console.log("==========> Email address:", data.emailAddress);
    console.log("==========> First name:", data.firstname);
    console.log("==========> Last name:", data.lastname);

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
    };

    console.log("==========> Processed data:", processedData);
    console.log("==========> Attempting schema validation...");

    // Validate data
    const validatedData = clientFormSchema.parse(processedData);

    console.log("==========> Validation successful:", validatedData);

    // Get current user ID and tenant ID
    const session = await getSession();
    if (!session?.user?.id) {
      console.error("==========> User not authenticated");
      throw new Error("User not authenticated");
    }
    const userId = session.user.id;
    const createdByUserName = session.user.name || session.user.email || userId;
    console.log("==========> User ID from session:", userId);
    console.log("==========> Created by user name:", createdByUserName);

    // Get or create the default tenant
    const tenant = await getOrCreateDefaultTenant();
    const tenantId = tenant.id;
    console.log("==========> Tenant ID:", tenantId);

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
          status: "DRAFT",
        },
      });

      console.log("==========> Lead updated successfully");
      revalidatePath("/leads");
      return { success: true, leadId };
    } else {
      console.log("==========> Creating new lead...");
      // Create new lead
      const lead = await prisma.lead.create({
        data: {
          userId,
          createdByUserName,
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
          status: "DRAFT",
        },
      });

      console.log("==========> New lead created with ID:", lead.id);
      revalidatePath("/leads");
      return { success: true, leadId: lead.id };
    }
  } catch (error) {
    console.error("==========> Error saving draft:", error);
    console.error(
      "==========> Error name:",
      error instanceof Error ? error.name : typeof error
    );
    console.error(
      "==========> Error message:",
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && "issues" in error) {
      console.error("==========> Validation errors:", (error as any).issues);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save draft",
    };
  }
}

// Get lead action
export async function getLead(leadId: string) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        familyMembers: true,
      },
    });

    return lead;
  } catch (error) {
    console.error("Error getting lead:", error);
    return null;
  }
}

// Close lead action
export async function closeLead(leadId: string, reason: string) {
  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "CLOSED",
        closedReason: reason,
        updatedAt: new Date(),
      },
    });

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Error closing lead:", error);
    return { success: false, error: "Failed to close lead" };
  }
}

// Submit lead action
export async function submitLead(leadId: string) {
  try {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "SUBMITTED",
        submittedOnDate: new Date(),
      },
    });

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Error submitting lead:", error);
    return { success: false, error: "Failed to submit lead" };
  }
}

// Add family member action
export async function addFamilyMember(
  leadId: string,
  data: z.infer<typeof familyMemberSchema>
) {
  try {
    // Validate data
    const validatedData = familyMemberSchema.parse(data);

    await prisma.familyMember.create({
      data: {
        firstname: validatedData.firstname,
        lastname: validatedData.lastname,
        middlename: validatedData.middlename,
        relationship: validatedData.relationship,
        dateOfBirth: validatedData.dateOfBirth || undefined,
        mobileNo: validatedData.mobileNo,
        emailAddress: validatedData.emailAddress,
        isDependent: validatedData.isDependent,
        leadId,
      },
    });

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Error adding family member:", error);
    return { success: false, error: "Failed to add family member" };
  }
}

// Update family member action
export async function updateFamilyMember(
  id: string,
  data: z.infer<typeof familyMemberSchema>
) {
  try {
    // Validate data
    const validatedData = familyMemberSchema.parse(data);

    await prisma.familyMember.update({
      where: { id },
      data: {
        firstname: validatedData.firstname,
        lastname: validatedData.lastname,
        middlename: validatedData.middlename,
        relationship: validatedData.relationship,
        dateOfBirth: validatedData.dateOfBirth || undefined,
        mobileNo: validatedData.mobileNo,
        emailAddress: validatedData.emailAddress,
        isDependent: validatedData.isDependent,
      },
    });

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Error updating family member:", error);
    return { success: false, error: "Failed to update family member" };
  }
}

// Remove family member action
export async function removeFamilyMember(id: string) {
  try {
    await prisma.familyMember.delete({
      where: { id },
    });

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Error removing family member:", error);
    return { success: false, error: "Failed to remove family member" };
  }
}

// Define types for lookup tables
type Office = {
  id: number;
  name: string;
  description: string | null;
};

type LegalForm = {
  id: number;
  name: string;
  description: string | null;
};

type Gender = {
  id: number;
  name: string;
  description: string | null;
};

type DocumentType = {
  id: number;
  name: string;
  description: string | null;
};

type ClientType = {
  id: number;
  name: string;
  description: string | null;
};

type ClientClassification = {
  id: number;
  name: string;
  description: string | null;
};

type SavingsProduct = {
  id: number;
  name: string;
  description: string | null;
  interestRate: number;
  minBalance: number;
};

// Fetch data from Fineract API
export async function fetchFineractClientTemplate() {
  try {
    const fineractBaseURL =
      process.env.FINERACT_BASE_URL || "http://41.174.125.165:4032";
    const response = await fetch(
      `${fineractBaseURL}/fineract-provider/api/v1/clients/template?staffInSelectedOfficeOnly=true`,
      {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Authorization: "Basic bWlmb3M6cGFzc3dvcmQ=",
          Connection: "keep-alive",
          "Fineract-Platform-TenantId": "goodfellow",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching data from Fineract API:", error);
    throw error;
  }
}

// Get all client template data at once
export async function getClientTemplateData() {
  try {
    // Try to fetch from Fineract API first
    try {
      const fineractData = await fetchFineractClientTemplate();

      if (fineractData) {
        // Extract and format all data from the single API response
        const result = {
          offices: fineractData.officeOptions
            ? fineractData.officeOptions.map((office: any) => ({
                id: office.id,
                name: office.name,
                description: office.nameDecorated,
              }))
            : [],

          legalForms: fineractData.clientLegalFormOptions
            ? fineractData.clientLegalFormOptions.map((form: any) => ({
                id: form.id,
                name: form.value,
                description: form.code,
              }))
            : [],

          genders: fineractData.genderOptions
            ? fineractData.genderOptions.map((gender: any) => ({
                id: gender.id,
                name: gender.name,
                description: gender.description,
              }))
            : [],

          clientTypes: fineractData.clientTypeOptions
            ? fineractData.clientTypeOptions.map((type: any) => ({
                id: type.id,
                name: type.name,
                description: type.description,
              }))
            : [],

          clientClassifications: fineractData.clientClassificationOptions
            ? fineractData.clientClassificationOptions.map(
                (classification: any) => ({
                  id: classification.id,
                  name: classification.name,
                  description: classification.description,
                })
              )
            : [],

          savingsProducts: fineractData.savingProductOptions
            ? fineractData.savingProductOptions.map((product: any) => ({
                id: product.id,
                name: product.name,
                description: product.name,
                interestRate: 0,
                minBalance: 0,
              }))
            : [],

          activationDate: fineractData.activationDate
            ? new Date(
                fineractData.activationDate[0],
                fineractData.activationDate[1] - 1,
                fineractData.activationDate[2]
              )
            : null,
        };

        return { success: true, data: result };
      }
    } catch (error) {
      console.error(
        "Error fetching data from Fineract API, falling back to database:",
        error
      );
    }

    // Fallback to database if API fails
    const [
      offices,
      legalForms,
      genders,
      clientTypes,
      clientClassifications,
      savingsProducts,
    ] = await Promise.all([
      prisma.$queryRaw<Office[]>`SELECT * FROM "Office" ORDER BY name ASC`,
      prisma.$queryRaw<
        LegalForm[]
      >`SELECT * FROM "LegalForm" ORDER BY name ASC`,
      prisma.$queryRaw<Gender[]>`SELECT * FROM "Gender" ORDER BY name ASC`,
      prisma.$queryRaw<
        ClientType[]
      >`SELECT * FROM "ClientType" ORDER BY name ASC`,
      prisma.$queryRaw<
        ClientClassification[]
      >`SELECT * FROM "ClientClassification" ORDER BY name ASC`,
      prisma.$queryRaw<
        SavingsProduct[]
      >`SELECT * FROM "SavingsProduct" ORDER BY name ASC`,
    ]);

    return {
      success: true,
      data: {
        offices,
        legalForms,
        genders,
        clientTypes,
        clientClassifications,
        savingsProducts,
        activationDate: null,
      },
    };
  } catch (error) {
    console.error("Error getting client template data:", error);
    return {
      success: false,
      error: "Failed to fetch client template data",
      data: {
        offices: [],
        legalForms: [],
        genders: [],
        clientTypes: [],
        clientClassifications: [],
        savingsProducts: [],
        activationDate: null,
      },
    };
  }
}

// Individual data access functions that use the cached data from getClientTemplateData
// These are kept for backward compatibility

// Get offices action
export async function getOffices(): Promise<Office[]> {
  try {
    const result = await getClientTemplateData();
    return result.data.offices;
  } catch (error) {
    console.error("Error getting offices:", error);
    return [];
  }
}

// Add office action
export async function addOffice(params: Office) {
  return null;
}

// Get legal forms action
export async function getLegalForms(): Promise<LegalForm[]> {
  try {
    const result = await getClientTemplateData();
    return result.data.legalForms;
  } catch (error) {
    console.error("Error getting legal forms:", error);
    return [];
  }
}

// Add legal form action
export async function addLegalForm(params: LegalForm) {
  return null;
}

// Get genders action
export async function getGenders(): Promise<Gender[]> {
  try {
    const result = await getClientTemplateData();
    return result.data.genders;
  } catch (error) {
    console.error("Error getting genders:", error);
    return [];
  }
}

// Add Gender action
export async function addGender(params: Gender) {
  try {
    // First, fetch all codes to find the Gender code ID
    const codesResponse = await fetchFineractAPI("/codes");

    // Handle both array response and wrapped response
    const codes = Array.isArray(codesResponse)
      ? codesResponse
      : codesResponse?.data || codesResponse || [];

    // Find the code named "Gender"
    const genderCode = codes.find((c: any) => c.name === "Gender");

    if (!genderCode || !genderCode.id) {
      throw new Error("Gender code not found in Fineract");
    }

    const codeId = genderCode.id;

    // Prepare the payload for Fineract code value creation
    const payload = {
      name: params.name,
      description: params.description || params.name,
      position: 0,
      isActive: true,
    };

    console.log(
      "Creating gender with payload:",
      JSON.stringify(payload, null, 2)
    );
    console.log("Using code ID:", codeId);
    console.log("Endpoint:", `/codes/${codeId}/codevalues`);

    // Create code value in Fineract for gender using the code ID
    const result = await fetchFineractAPI(`/codes/${codeId}/codevalues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Return the created gender with the ID from Fineract
    return {
      id: result.resourceId || result.id,
      name: params.name,
      description: params.description || null,
    };
  } catch (error: any) {
    console.error("Error adding gender:", error);
    console.error("Error details:", {
      status: error?.status,
      errorData: error?.errorData,
      message: error?.message,
    });

    // Extract the actual error message from Fineract
    const fineractError =
      error?.errorData?.defaultUserMessage ||
      error?.errorData?.developerMessage ||
      error?.errorData?.errors?.[0]?.defaultUserMessage ||
      error?.errorData?.errors?.[0]?.developerMessage ||
      error?.message ||
      "Failed to create gender in Fineract";

    throw new Error(
      `Failed to create gender: ${fineractError} (Status: ${
        error?.status || "Unknown"
      })`
    );
  }
}

// Get Document Types (Customer Identifier) action
export async function getDocumentTypes(): Promise<DocumentType[]> {
  try {
    // First, fetch all codes to find the Customer Identifier code ID
    const codesResponse = await fetchFineractAPI("/codes");

    // Handle both array response and wrapped response
    const codes = Array.isArray(codesResponse)
      ? codesResponse
      : codesResponse?.data || codesResponse || [];

    // Find the code named "Customer Identifier"
    const customerIdentifierCode = codes.find(
      (c: any) => c.name === "Customer Identifier"
    );

    if (!customerIdentifierCode || !customerIdentifierCode.id) {
      console.warn(
        "Customer Identifier code not found in Fineract, returning empty array"
      );
      return [];
    }

    const codeId = customerIdentifierCode.id;

    // Fetch code values for the Customer Identifier code
    const codeValuesResponse = await fetchFineractAPI(
      `/codes/${codeId}/codevalues`
    );

    // Handle both array response and wrapped response
    const codeValues = Array.isArray(codeValuesResponse)
      ? codeValuesResponse
      : codeValuesResponse?.data || codeValuesResponse || [];

    // Map to the expected format
    return codeValues
      .filter((cv: any) => cv.active !== false)
      .map((cv: any) => ({
        id: cv.id,
        name: cv.name,
        description: cv.description || cv.name,
      }));
  } catch (error) {
    console.error("Error getting document types:", error);
    return [];
  }
}

// Add Document Type (Customer Identifier) action
export async function addDocumentType(params: DocumentType) {
  try {
    // First, fetch all codes to find the Customer Identifier code ID
    const codesResponse = await fetchFineractAPI("/codes");

    // Handle both array response and wrapped response
    const codes = Array.isArray(codesResponse)
      ? codesResponse
      : codesResponse?.data || codesResponse || [];

    // Find the code named "Customer Identifier"
    const customerIdentifierCode = codes.find(
      (c: any) => c.name === "Customer Identifier"
    );

    if (!customerIdentifierCode || !customerIdentifierCode.id) {
      throw new Error("Customer Identifier code not found in Fineract");
    }

    const codeId = customerIdentifierCode.id;

    // Prepare the payload for Fineract code value creation
    const payload = {
      name: params.name,
      description: params.description || params.name,
      position: 0,
      isActive: true,
    };

    console.log(
      "Creating document type with payload:",
      JSON.stringify(payload, null, 2)
    );
    console.log("Using code ID:", codeId);
    console.log("Endpoint:", `/codes/${codeId}/codevalues`);

    // Create code value in Fineract for document type using the code ID
    const result = await fetchFineractAPI(`/codes/${codeId}/codevalues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Return the created document type with the ID from Fineract
    return {
      id: result.resourceId || result.id,
      name: params.name,
      description: params.description || null,
    };
  } catch (error: any) {
    console.error("Error adding document type:", error);
    console.error("Error details:", {
      status: error?.status,
      errorData: error?.errorData,
      message: error?.message,
    });

    // Extract the actual error message from Fineract
    const fineractError =
      error?.errorData?.defaultUserMessage ||
      error?.errorData?.developerMessage ||
      error?.errorData?.errors?.[0]?.defaultUserMessage ||
      error?.errorData?.errors?.[0]?.developerMessage ||
      error?.message ||
      "Failed to create document type in Fineract";

    throw new Error(
      `Failed to create document type: ${fineractError} (Status: ${
        error?.status || "Unknown"
      })`
    );
  }
}

// Get client types action
export async function getClientTypes(): Promise<ClientType[]> {
  try {
    const result = await getClientTemplateData();
    return result.data.clientTypes;
  } catch (error) {
    console.error("Error getting client types:", error);
    return [];
  }
}

// Add Client Type action
export async function addClientType(params: ClientType) {
  try {
    // First, fetch all codes to find the ClientType code ID
    const codesResponse = await fetchFineractAPI("/codes");

    // Handle both array response and wrapped response
    const codes = Array.isArray(codesResponse)
      ? codesResponse
      : codesResponse?.data || codesResponse || [];

    // Find the code named "ClientType"
    const clientTypeCode = codes.find(
      (c: any) => c.name?.toLowerCase() === "clienttype"
    );

    if (!clientTypeCode || !clientTypeCode.id) {
      throw new Error("ClientType code not found in Fineract");
    }

    const codeId = clientTypeCode.id;

    // Prepare the payload for Fineract code value creation
    const payload = {
      name: params.name,
      description: params.description || params.name,
      position: 0,
      isActive: true,
    };

    console.log(
      "Creating client type with payload:",
      JSON.stringify(payload, null, 2)
    );
    console.log("Using code ID:", codeId);
    console.log("Endpoint:", `/codes/${codeId}/codevalues`);

    // Create code value in Fineract for client type using the code ID
    const result = await fetchFineractAPI(`/codes/${codeId}/codevalues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Return the created client type with the ID from Fineract
    return {
      id: result.resourceId || result.id,
      name: params.name,
      description: params.description || null,
    };
  } catch (error: any) {
    console.error("Error adding client type:", error);
    console.error("Error details:", {
      status: error?.status,
      errorData: error?.errorData,
      message: error?.message,
    });

    // Extract the actual error message from Fineract
    const fineractError =
      error?.errorData?.defaultUserMessage ||
      error?.errorData?.developerMessage ||
      error?.errorData?.errors?.[0]?.defaultUserMessage ||
      error?.errorData?.errors?.[0]?.developerMessage ||
      error?.message ||
      "Failed to create client type in Fineract";

    throw new Error(
      `Failed to create client type: ${fineractError} (Status: ${
        error?.status || "Unknown"
      })`
    );
  }
}

// Get client classifications action
export async function getClientClassifications(): Promise<
  ClientClassification[]
> {
  try {
    const result = await getClientTemplateData();
    return result.data.clientClassifications;
  } catch (error) {
    console.error("Error getting client classifications:", error);
    return [];
  }
}

// Add Client Classification Type action
export async function addClientClassification(params: ClientClassification) {
  try {
    // First, fetch all codes to find the ClientClassification code ID
    const codesResponse = await fetchFineractAPI("/codes");

    // Handle both array response and wrapped response
    const codes = Array.isArray(codesResponse)
      ? codesResponse
      : codesResponse?.data || codesResponse || [];

    // Find the code named "ClientClassification"
    const clientClassificationCode = codes.find(
      (c: any) => c.name === "ClientClassification"
    );

    if (!clientClassificationCode || !clientClassificationCode.id) {
      throw new Error("ClientClassification code not found in Fineract");
    }

    const codeId = clientClassificationCode.id;

    // Prepare the payload for Fineract code value creation
    const payload = {
      name: params.name,
      description: params.description || params.name,
      position: 0,
      isActive: true,
    };

    console.log(
      "Creating client classification with payload:",
      JSON.stringify(payload, null, 2)
    );
    console.log("Using code ID:", codeId);
    console.log("Endpoint:", `/codes/${codeId}/codevalues`);

    // Create code value in Fineract for client classification using the code ID
    const result = await fetchFineractAPI(`/codes/${codeId}/codevalues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Return the created client classification with the ID from Fineract
    return {
      id: result.resourceId || result.id,
      name: params.name,
      description: params.description || null,
    };
  } catch (error: any) {
    console.error("Error adding client classification:", error);
    console.error("Error details:", {
      status: error?.status,
      errorData: error?.errorData,
      message: error?.message,
    });

    // Extract the actual error message from Fineract
    const fineractError =
      error?.errorData?.defaultUserMessage ||
      error?.errorData?.developerMessage ||
      error?.errorData?.errors?.[0]?.defaultUserMessage ||
      error?.errorData?.errors?.[0]?.developerMessage ||
      error?.message ||
      "Failed to create client classification in Fineract";

    throw new Error(
      `Failed to create client classification: ${fineractError} (Status: ${
        error?.status || "Unknown"
      })`
    );
  }
}

// Get savings products action
export async function getSavingsProducts(): Promise<SavingsProduct[]> {
  try {
    const result = await getClientTemplateData();
    return result.data.savingsProducts;
  } catch (error) {
    console.error("Error getting savings products:", error);
    return [];
  }
}

// Add Savings Product Type action
export async function addSavingsProduct(params: SavingsProduct) {
  return null;
}

// Get activation date from Fineract API
export async function getActivationDate(): Promise<Date | null> {
  try {
    const result = await getClientTemplateData();
    return result.data.activationDate;
  } catch (error) {
    console.error("Error getting activation date:", error);
    return null;
  }
}

// Add Address Type action
export async function addAddressType(params: {
  id: number;
  name: string;
  description: string | null;
}) {
  try {
    // First, fetch all codes to find the ADDRESS_TYPE code ID
    const codesResponse = await fetchFineractAPI("/codes");

    // Handle both array response and wrapped response
    const codes = Array.isArray(codesResponse)
      ? codesResponse
      : codesResponse?.data || codesResponse || [];

    // Find the code named "ADDRESS_TYPE"
    const addressTypeCode = codes.find(
      (c: any) => c.name?.toUpperCase() === "ADDRESS_TYPE"
    );

    if (!addressTypeCode || !addressTypeCode.id) {
      throw new Error("ADDRESS_TYPE code not found in Fineract");
    }

    const codeId = addressTypeCode.id;

    // Prepare the payload for Fineract code value creation
    const payload = {
      name: params.name,
      description: params.description || params.name,
      position: 0,
      isActive: true,
    };

    console.log(
      "Creating address type with payload:",
      JSON.stringify(payload, null, 2)
    );
    console.log("Using code ID:", codeId);
    console.log("Endpoint:", `/codes/${codeId}/codevalues`);

    // Create code value in Fineract for address type using the code ID
    const result = await fetchFineractAPI(`/codes/${codeId}/codevalues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Return the created address type with the ID from Fineract
    return {
      id: result.resourceId || result.id,
      name: params.name,
      description: params.description || null,
    };
  } catch (error: any) {
    console.error("Error adding address type:", error);
    console.error("Error details:", {
      status: error?.status,
      errorData: error?.errorData,
      message: error?.message,
    });

    // Extract the actual error message from Fineract
    const fineractError =
      error?.errorData?.defaultUserMessage ||
      error?.errorData?.developerMessage ||
      error?.errorData?.errors?.[0]?.defaultUserMessage ||
      error?.errorData?.errors?.[0]?.developerMessage ||
      error?.message ||
      "Failed to create address type in Fineract";

    throw new Error(
      `Failed to create address type: ${fineractError} (Status: ${
        error?.status || "Unknown"
      })`
    );
  }
}

// Add Country action
export async function addCountry(params: {
  id: number;
  name: string;
  description: string | null;
}) {
  try {
    // First, fetch all codes to find the COUNTRY code ID
    const codesResponse = await fetchFineractAPI("/codes");

    // Handle both array response and wrapped response
    const codes = Array.isArray(codesResponse)
      ? codesResponse
      : codesResponse?.data || codesResponse || [];

    // Find the code named "COUNTRY"
    const countryCode = codes.find(
      (c: any) => c.name?.toUpperCase() === "COUNTRY"
    );

    if (!countryCode || !countryCode.id) {
      throw new Error("COUNTRY code not found in Fineract");
    }

    const codeId = countryCode.id;

    // Prepare the payload for Fineract code value creation
    const payload = {
      name: params.name,
      description: params.description || params.name,
      position: 0,
      isActive: true,
    };

    console.log(
      "Creating country with payload:",
      JSON.stringify(payload, null, 2)
    );
    console.log("Using code ID:", codeId);
    console.log("Endpoint:", `/codes/${codeId}/codevalues`);

    // Create code value in Fineract for country using the code ID
    const result = await fetchFineractAPI(`/codes/${codeId}/codevalues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Return the created country with the ID from Fineract
    return {
      id: result.resourceId || result.id,
      name: params.name,
      description: params.description || null,
    };
  } catch (error: any) {
    console.error("Error adding country:", error);
    console.error("Error details:", {
      status: error?.status,
      errorData: error?.errorData,
      message: error?.message,
    });

    // Extract the actual error message from Fineract
    const fineractError =
      error?.errorData?.defaultUserMessage ||
      error?.errorData?.developerMessage ||
      error?.errorData?.errors?.[0]?.defaultUserMessage ||
      error?.errorData?.errors?.[0]?.developerMessage ||
      error?.message ||
      "Failed to create country in Fineract";

    throw new Error(
      `Failed to create country: ${fineractError} (Status: ${
        error?.status || "Unknown"
      })`
    );
  }
}

// Add State/Province action
// Get Relationships action
export async function getRelationships(): Promise<
  Array<{ id: number; name: string; description: string | null }>
> {
  try {
    // First, fetch all codes to find the RELATIONSHIP code ID
    const codesResponse = await fetchFineractAPI("/codes");

    // Handle both array response and wrapped response
    const codes = Array.isArray(codesResponse)
      ? codesResponse
      : codesResponse?.data || codesResponse || [];

    // Find the code named "RELATIONSHIP" (case-insensitive)
    const relationshipCode = codes.find(
      (c: any) => c.name?.toUpperCase() === "RELATIONSHIP"
    );

    if (!relationshipCode || !relationshipCode.id) {
      console.warn(
        "RELATIONSHIP code not found in Fineract, returning empty array"
      );
      return [];
    }

    const codeId = relationshipCode.id;

    // Fetch code values for the RELATIONSHIP code
    const codeValuesResponse = await fetchFineractAPI(
      `/codes/${codeId}/codevalues`
    );

    // Handle both array response and wrapped response
    const codeValues = Array.isArray(codeValuesResponse)
      ? codeValuesResponse
      : codeValuesResponse?.data || codeValuesResponse || [];

    // Map to the expected format
    return codeValues
      .filter((cv: any) => cv.active !== false)
      .map((cv: any) => ({
        id: cv.id,
        name: cv.name,
        description: cv.description || cv.name,
      }));
  } catch (error) {
    console.error("Error getting relationships:", error);
    return [];
  }
}

// Add Relationship action
export async function addRelationship(params: {
  id: number;
  name: string;
  description: string | null;
}) {
  try {
    // First, fetch all codes to find the RELATIONSHIP code ID
    const codesResponse = await fetchFineractAPI("/codes");

    // Handle both array response and wrapped response
    const codes = Array.isArray(codesResponse)
      ? codesResponse
      : codesResponse?.data || codesResponse || [];

    // Find the code named "RELATIONSHIP" (case-insensitive)
    const relationshipCode = codes.find(
      (c: any) => c.name?.toUpperCase() === "RELATIONSHIP"
    );

    if (!relationshipCode || !relationshipCode.id) {
      throw new Error("RELATIONSHIP code not found in Fineract");
    }

    const codeId = relationshipCode.id;

    // Prepare the payload for Fineract code value creation
    const payload = {
      name: params.name,
      description: params.description || params.name,
      position: 0,
      isActive: true,
    };

    console.log(
      "Creating relationship with payload:",
      JSON.stringify(payload, null, 2)
    );
    console.log("Using code ID:", codeId);
    console.log("Endpoint:", `/codes/${codeId}/codevalues`);

    // Create code value in Fineract for relationship using the code ID
    const result = await fetchFineractAPI(`/codes/${codeId}/codevalues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Return the created relationship with the ID from Fineract
    return {
      success: true,
      data: {
        id: result.resourceId || result.id,
        name: params.name,
        description: params.description || params.name,
      },
    };
  } catch (error: any) {
    console.error("Error adding relationship:", error);
    const errorMessage =
      error?.response?.data?.defaultUserMessage ||
      error?.response?.data?.developerMessage ||
      error?.message ||
      "Failed to add relationship";

    console.error("API Error Details:", {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      errorData: JSON.stringify(error?.response?.data || {}),
    });

    return {
      success: false,
      error: `API error: ${
        error?.response?.status || "Unknown"
      }. ${errorMessage}`,
    };
  }
}

export async function addStateProvince(params: {
  id: number;
  name: string;
  description: string | null;
}) {
  try {
    // First, fetch all codes to find the STATE code ID
    const codesResponse = await fetchFineractAPI("/codes");

    // Handle both array response and wrapped response
    const codes = Array.isArray(codesResponse)
      ? codesResponse
      : codesResponse?.data || codesResponse || [];

    // Find the code named "STATE"
    const stateCode = codes.find((c: any) => c.name?.toUpperCase() === "STATE");

    if (!stateCode || !stateCode.id) {
      throw new Error("STATE code not found in Fineract");
    }

    const codeId = stateCode.id;

    // Prepare the payload for Fineract code value creation
    const payload = {
      name: params.name,
      description: params.description || params.name,
      position: 0,
      isActive: true,
    };

    console.log(
      "Creating state/province with payload:",
      JSON.stringify(payload, null, 2)
    );
    console.log("Using code ID:", codeId);
    console.log("Endpoint:", `/codes/${codeId}/codevalues`);

    // Create code value in Fineract for state/province using the code ID
    const result = await fetchFineractAPI(`/codes/${codeId}/codevalues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // Return the created state/province with the ID from Fineract
    return {
      id: result.resourceId || result.id,
      name: params.name,
      description: params.description || null,
    };
  } catch (error: any) {
    console.error("Error adding state/province:", error);
    console.error("Error details:", {
      status: error?.status,
      errorData: error?.errorData,
      message: error?.message,
    });

    // Extract the actual error message from Fineract
    const fineractError =
      error?.errorData?.defaultUserMessage ||
      error?.errorData?.developerMessage ||
      error?.errorData?.errors?.[0]?.defaultUserMessage ||
      error?.errorData?.errors?.[0]?.developerMessage ||
      error?.message ||
      "Failed to create state/province in Fineract";

    throw new Error(
      `Failed to create state/province: ${fineractError} (Status: ${
        error?.status || "Unknown"
      })`
    );
  }
}
