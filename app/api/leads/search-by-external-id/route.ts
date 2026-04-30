import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/leads/search-by-external-id?externalId={externalId}
 * Searches for leads in local database by external ID (national ID)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const externalId = searchParams.get("externalId");

    if (!externalId) {
      return NextResponse.json(
        { error: "External ID is required" },
        { status: 400 }
      );
    }

    // Search for leads with the given external ID
    const leads = await prisma.lead.findMany({
      where: {
        externalId: externalId,
        // Only get leads that have been created in Fineract (have fineractClientId)
        fineractClientId: {
          not: null,
        },
      },
      select: {
        id: true,
        externalId: true,
        fullname: true,
        tradingName: true,
        registrationNumber: true,
        dateOfIncorporation: true,
        natureOfBusiness: true,
        businessAddress: true,
        firstname: true,
        middlename: true,
        lastname: true,
        dateOfBirth: true,
        gender: true,
        genderId: true,
        isStaff: true,
        mobileNo: true,
        countryCode: true,
        emailAddress: true,
        clientTypeId: true,
        clientTypeName: true,
        clientClassificationId: true,
        clientClassificationName: true,
        officeId: true,
        officeName: true,
        legalFormId: true,
        legalFormName: true,
        active: true,
        activationDate: true,
        submittedOnDate: true,
        fineractClientId: true,
        fineractAccountNo: true,
        clientCreatedInFineract: true,
        clientCreationDate: true,
        // Financial fields
        monthlyIncomeRange: true,
        employmentStatus: true,
        employerName: true,
        yearsAtCurrentJob: true,
        hasExistingLoans: true,
        monthlyDebtPayments: true,
        propertyOwnership: true,
        businessOwnership: true,
        businessType: true,
        // Family members
        familyMembers: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc", // Get the most recent lead first
      },
    });

    return NextResponse.json({
      success: true,
      leads: leads,
      count: leads.length,
    });
  } catch (error: any) {
    console.error("Error searching leads by external ID:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search leads" },
      { status: 500 }
    );
  }
}
