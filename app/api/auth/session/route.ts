import { NextResponse } from "next/server";
import { getSession } from "@/app/actions/auth";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Return user info without the access token for security
    return NextResponse.json({
      user: {
        id: session.id,
        name: session.name,
        email: session.email,
      },
    });
  } catch (error) {
    console.error("Session API error:", error);
    return NextResponse.json(
      { error: "Failed to get session" },
      { status: 500 }
    );
  }
}
