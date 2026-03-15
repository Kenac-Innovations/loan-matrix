import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const data = await fetchFineractAPI(`/loans/${loanId}/documents`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loan documents:", error);
    
    // If it's a Fineract API error with status code, preserve it
    if (error.status && error.errorData) {
      return NextResponse.json(
        error.errorData,
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch loan documents" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    
    // Handle multipart form data for file upload
    const formData = await request.formData();
    
    // Create FormData for the Fineract API call
    const fineractFormData = new FormData();
    
    // Get the form fields
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const file = formData.get('file') as File;
    
    if (!name || !file) {
      return NextResponse.json(
        { error: "Name and file are required" },
        { status: 400 }
      );
    }
    
    // Add fields to FormData for Fineract API
    fineractFormData.append('name', name);
    fineractFormData.append('file', file);
    if (description) {
      fineractFormData.append('description', description);
    }
    
    // Use the existing fetchFineractAPI helper (now handles FormData correctly)
    const data = await fetchFineractAPI(`/loans/${loanId}/documents`, {
      method: "POST",
      body: fineractFormData,
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error uploading document:", error);
    
    // If it's a Fineract API error with status code, preserve it
    if (error.status && error.errorData) {
      return NextResponse.json(
        error.errorData,
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to upload document" },
      { status: 500 }
    );
  }
}
