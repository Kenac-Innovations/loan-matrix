import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';

/**
 * GET /api/fineract/loans/[id]/approve
 * Gets loan approval template data
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    // Get template type, default to 'approval'
    const templateType = searchParams.get('templateType') || 'approval';
    
    // Build the endpoint URL
    const endpoint = `/loans/${id}/template?templateType=${templateType}`;
    const data = await fetchFineractAPI(endpoint);
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching loan approval template:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fineract/loans/[id]/approve
 * Submits loan approval
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await request.json();
    
    // First, check the current loan status to provide better error messages
    try {
      const loanData = await fetchFineractAPI(`/loans/${id}`);
      const loanStatus = loanData.status?.value;
      
      // Check if loan is in a state that allows approval
      if (loanStatus && !['Submitted and pending approval', 'Submitted and Pending Approval'].includes(loanStatus)) {
        return NextResponse.json(
          { 
            error: `Cannot approve loan. Current status: ${loanStatus}. Loan must be in 'Submitted and pending approval' status to be approved.`,
            errorData: {
              defaultUserMessage: `Cannot approve loan. Current status: ${loanStatus}. Loan must be in 'Submitted and pending approval' status to be approved.`,
              developerMessage: `Loan status validation failed. Expected: 'Submitted and pending approval', Actual: '${loanStatus}'`,
              currentStatus: loanStatus
            }
          },
          { status: 400 }
        );
      }
    } catch (statusError) {
      console.warn('Could not fetch loan status for validation:', statusError);
      // Continue with approval attempt even if status check fails
    }
    
    // Build the endpoint URL with command as query parameter
    const endpoint = `/loans/${id}?command=approve`;
    
    const data = await fetchFineractAPI(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error approving loan:', error);
    
    // Enhanced error handling with better user messages
    let userMessage = 'Failed to approve loan';
    let statusCode = 500;
    
    if (error.status === 400) {
      statusCode = 400;
      if (error.errorData?.defaultUserMessage) {
        userMessage = error.errorData.defaultUserMessage;
      } else if (error.errorData?.developerMessage) {
        userMessage = error.errorData.developerMessage;
      } else if (error.message?.includes('not in submitted and pending approval state')) {
        userMessage = 'Cannot approve loan. The loan is not in the correct state for approval. Please ensure the loan is submitted and pending approval.';
      }
    }
    
    return NextResponse.json(
      { 
        error: userMessage,
        errorData: error.errorData || null,
        details: error.message || 'Unknown error'
      },
      { status: statusCode }
    );
  }
}
