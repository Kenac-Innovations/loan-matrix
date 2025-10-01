"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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
    // Validate data
    const validatedData = clientFormSchema.parse(data);

    // Get current user ID (in a real app, this would come from auth)
    const userId = "user_1"; // Placeholder - replace with actual user ID from auth

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

      revalidatePath("/leads");
      return { success: true, leadId };
    } else {
      // Create new lead
      const lead = await prisma.lead.create({
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
          user: {
            connect: {
              id: userId,
            },
          },
        },
      });

      revalidatePath("/leads");
      return { success: true, leadId: lead.id };
    }
  } catch (error) {
    console.error("Error saving draft:", error);
    return { success: false, error: "Failed to save draft" };
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
    const response = await fetch(
      "https://demo.mifos.io/fineract-provider/api/v1/clients/template?staffInSelectedOfficeOnly=true",
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
  return null;
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
  return null;
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
  return null;
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
