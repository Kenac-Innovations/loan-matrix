import { NextResponse } from 'next/server';
import { fetchFineractAPI } from '@/lib/api';
import {
  buildFineractErrorResponse,
  createFineractErrorResponsePayload,
} from '@/lib/fineract-route-error';

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
    const data = await fetchFineractAPI(endpoint, {
      authMode: "service",
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching loan approval template:', error);
    return buildFineractErrorResponse(error, {
      action: 'load',
      resource: 'loan approval template',
    });
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
      const loanData = await fetchFineractAPI(`/loans/${id}`, {
        authMode: "service",
      });
      const loanStatus = loanData.status?.value;
      
      // Check if loan is in a state that allows approval
      if (loanStatus && !['Submitted and pending approval', 'Submitted and Pending Approval'].includes(loanStatus)) {
        return NextResponse.json(
          { 
            error: `Cannot approve loan. Current status: ${loanStatus}. Loan must be in 'Submitted and pending approval' status to be approved.`,
            details: {
              currentStatus: loanStatus
            },
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

    if (
      error.message?.includes('not in submitted and pending approval state')
    ) {
      const errorResponse = createFineractErrorResponsePayload(error, {
        action: 'approve',
        resource: 'loan',
      });

      return NextResponse.json(
        {
          error:
            'Cannot approve loan. The loan is not in the correct state for approval. Please ensure the loan is submitted and pending approval.',
          details: errorResponse.body.details,
        },
        { status: errorResponse.status || 400 }
      );
    }

    return buildFineractErrorResponse(error, {
      action: 'approve',
      resource: 'loan',
    });
  }
}
