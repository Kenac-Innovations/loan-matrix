import { NextRequest, NextResponse } from "next/server";
import { getUssdAutoProcessingPollerStatus } from "@/lib/ussd-auto-processing-poller";

// There's no AMQP consumer in this app anymore — USSD loan application
// ingestion moved to loan-matrix-be. This reports the health of the
// auto-processing poller that replaced the old in-process consumer.
export async function GET(_request: NextRequest) {
  try {
    const status = getUssdAutoProcessingPollerStatus();
    const isHealthy =
      status.lastError === null &&
      (status.lastTickAt === null ||
        Date.now() - new Date(status.lastTickAt).getTime() < 60_000);

    return NextResponse.json({
      queue: {
        isRunning: status.lastTickAt !== null || status.isPolling,
        isHealthy,
        lastTickAt: status.lastTickAt,
        lastError: status.lastError,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error checking USSD auto-processing poller health:", error);
    return NextResponse.json(
      {
        queue: {
          isRunning: false,
          isHealthy: false,
        },
        error: "Failed to check poller health",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
