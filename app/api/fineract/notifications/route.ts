import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";

// GET /api/fineract/notifications - Get all notifications
export async function GET(request: NextRequest) {
  try {
    const notifications = await fetchFineractAPI("/notifications");
    return NextResponse.json(notifications);
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    return buildFineractErrorResponse(error, {
      action: "load",
      resource: "notifications",
    });
  }
}

// PUT /api/fineract/notifications - Mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    const result = await fetchFineractAPI("/notifications", {
      method: "PUT",
      body: JSON.stringify(body),
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error updating notifications:", error);
    return buildFineractErrorResponse(error, {
      action: "update",
      resource: "notifications",
    });
  }
}
