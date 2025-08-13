import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/leads/template
 * Gets the lead template data (offices, legal forms, genders, etc.)
 */
export async function GET() {
  try {
    // Try to fetch from Fineract API first
    try {
      const fineractData = await fetchFineractAPI('/clients/template?staffInSelectedOfficeOnly=true');

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

        return NextResponse.json({ success: true, data: result });
      }
    } catch (error) {
      console.error(
        "Error fetching data from Fineract API, falling back to database:",
        error
      );
    }

    // Fallback to database if API fails
    // For now, return empty data since we're keeping Prisma as is
    return NextResponse.json({
      success: true,
      data: {
        offices: [],
        legalForms: [],
        genders: [],
        clientTypes: [],
        clientClassifications: [],
        savingsProducts: [],
        activationDate: null,
      },
    });
  } catch (error: any) {
    console.error("Error getting lead template data:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch lead template data",
        data: {
          offices: [],
          legalForms: [],
          genders: [],
          clientTypes: [],
          clientClassifications: [],
          savingsProducts: [],
          activationDate: null,
        }
      },
      { status: 500 }
    );
  }
}
