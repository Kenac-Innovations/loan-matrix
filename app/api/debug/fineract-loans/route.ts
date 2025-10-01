import { NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

export async function GET() {
  try {
    console.log("=== Fineract Loans Debug Test ===");
    
    // Test 1: Check environment variables
    console.log("Environment Variables:", {
      FINERACT_BASE_URL: process.env.FINERACT_BASE_URL,
      FINERACT_TENANT_ID: process.env.FINERACT_TENANT_ID,
      FINERACT_USERNAME: process.env.FINERACT_USERNAME,
      FINERACT_PASSWORD: process.env.FINERACT_PASSWORD ? "***" : "NOT SET"
    });

    // Test 2: Initialize Fineract service
    console.log("Initializing Fineract service...");
    const fineractService = await getFineractServiceWithSession();
    console.log("Fineract service initialized successfully");

    // Test 3: Try to get loans
    console.log("Fetching loans...");
    const loans = await fineractService.getLoans(0, 10);
    console.log("Loans fetched:", {
      count: Array.isArray(loans) ? loans.length : 'Not an array',
      type: typeof loans,
      isArray: Array.isArray(loans)
    });

    return NextResponse.json({
      success: true,
      environment: {
        FINERACT_BASE_URL: process.env.FINERACT_BASE_URL,
        FINERACT_TENANT_ID: process.env.FINERACT_TENANT_ID,
        FINERACT_USERNAME: process.env.FINERACT_USERNAME,
        FINERACT_PASSWORD: process.env.FINERACT_PASSWORD ? "***" : "NOT SET"
      },
      loans: {
        count: Array.isArray(loans) ? loans.length : 0,
        type: typeof loans,
        isArray: Array.isArray(loans),
        sample: Array.isArray(loans) && loans.length > 0 ? loans[0] : null
      }
    });

  } catch (error: any) {
    console.error("Fineract Debug Test Error:", error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      environment: {
        FINERACT_BASE_URL: process.env.FINERACT_BASE_URL,
        FINERACT_TENANT_ID: process.env.FINERACT_TENANT_ID,
        FINERACT_USERNAME: process.env.FINERACT_USERNAME,
        FINERACT_PASSWORD: process.env.FINERACT_PASSWORD ? "***" : "NOT SET"
      }
    }, { status: 500 });
  }
}
