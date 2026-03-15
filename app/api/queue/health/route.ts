import { NextRequest, NextResponse } from "next/server";
import { getUssdQueueConsumer } from "@/lib/ussd-queue-consumer";

export async function GET(request: NextRequest) {
  try {
    const consumer = getUssdQueueConsumer();
    const status = consumer.getStatus();

    return NextResponse.json({
      queue: {
        isRunning: status.isRunning,
        isHealthy: status.isHealthy,
        queueHealthy: status.queueHealthy,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error checking queue health:", error);
    return NextResponse.json(
      { 
        queue: {
          isRunning: false,
          isHealthy: false,
          queueHealthy: false,
        },
        error: "Failed to check queue health",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
