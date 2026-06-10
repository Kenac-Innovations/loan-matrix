import { NextResponse } from "next/server";
import { getUssdQueueConsumer } from "@/lib/ussd-queue-consumer";
import { getBulkRepaymentQueueService } from "@/lib/bulk-repayment-queue-service";

export async function GET() {
  try {
    const consumer = getUssdQueueConsumer();
    const status = consumer.getStatus();
    const bulkQueue = getBulkRepaymentQueueService();
    const bulkStatus = bulkQueue.getStatus();

    return NextResponse.json({
      queue: {
        isRunning: status.isRunning,
        isHealthy: status.isHealthy,
        queueHealthy: status.queueHealthy,
      },
      bulkRepaymentQueue: {
        isRunning: bulkStatus.isRunning,
        isHealthy: bulkStatus.isHealthy,
        queueHealthy: bulkStatus.queueHealthy,
        isConnected: bulkStatus.isConnected,
        isConsuming: bulkStatus.isConsuming,
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
        bulkRepaymentQueue: {
          isRunning: false,
          isHealthy: false,
          queueHealthy: false,
          isConnected: false,
          isConsuming: false,
        },
        error: "Failed to check queue health",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
