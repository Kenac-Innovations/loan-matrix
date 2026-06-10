// Queue consumer initialization
// This module initializes the queue consumers when imported

import { getUssdQueueConsumer } from './ussd-queue-consumer';
import { getBulkRepaymentQueueService } from './bulk-repayment-queue-service';
import { getBulkRepaymentReversalQueueService } from './bulk-repayment-reversal-queue-service';
import prisma from './prisma';
import { refreshBulkRepaymentUploadStats } from './bulk-repayment-upload-stats';

// Prevent multiple initializations using global variable
declare global {
  var __queueConsumerInitialized: boolean | undefined;
  var __bulkRepaymentRecoveryIntervalStarted: boolean | undefined;
}

async function cleanupOrphanedItems(): Promise<void> {
  try {
    // Items stuck in QUEUED or PROCESSING for > 30 minutes have no live worker
    // behind them (pod crash, DB blip during ack, etc). Mark them FAILED so the
    // user can see them and retry from the UI instead of waiting indefinitely.
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const orphaned = await prisma.bulkRepaymentItem.findMany({
      where: {
        status: { in: ["QUEUED", "PROCESSING"] },
        updatedAt: { lt: cutoff },
      },
      select: { id: true, uploadId: true },
    });

    if (orphaned.length === 0) return;

    await prisma.bulkRepaymentItem.updateMany({
      where: { id: { in: orphaned.map((i) => i.id) } },
      data: {
        status: "FAILED",
        errorMessage: "Processing timed out - please retry",
        processedAt: new Date(),
      },
    });

    const uploadIds = [...new Set(orphaned.map((i) => i.uploadId))];
    for (const uploadId of uploadIds) {
      await refreshBulkRepaymentUploadStats(uploadId);
    }

    console.log(`[Startup] Cleaned up ${orphaned.length} orphaned bulk repayment item(s) across ${uploadIds.length} upload(s)`);
  } catch (error) {
    console.error('[Startup] Failed to clean up orphaned bulk repayment items:', error);
  }
}

function startBulkRepaymentRecoveryLoop(): void {
  if (global.__bulkRepaymentRecoveryIntervalStarted) {
    return;
  }

  global.__bulkRepaymentRecoveryIntervalStarted = true;

  const intervalMs = 60 * 1000;

  const timer = setInterval(() => {
    const bulkService = getBulkRepaymentQueueService();
    bulkService
      .recoverStaleQueuedItems()
      .then((count) => {
        if (count > 0) {
          console.warn(
            `[Startup] Recovered ${count} stale bulk repayment item(s) from queued backlog`
          );
        }
      })
      .catch((error) => {
        console.error(
          "[Startup] Failed to recover stale bulk repayment items:",
          error
        );
      });
  }, intervalMs);

  timer.unref?.();

  console.log(
    `[Startup] Bulk repayment recovery loop started (interval ${intervalMs}ms)`
  );
}

// Initialize the queue consumers only once
if (process.env.NODE_ENV !== 'test' && !global.__queueConsumerInitialized) {
  global.__queueConsumerInitialized = true;

  // Clean up any items left stuck from a previous pod's crash or DB blip
  // before starting consumers so workers start with a clean slate.
  cleanupOrphanedItems().catch((error) => {
    console.error('[Startup] Orphan cleanup failed:', error);
  });

  // USSD Loan Application consumer
  try {
    const consumer = getUssdQueueConsumer();
    console.log('USSD queue consumer initialized');
    consumer.start().catch((error) => {
      console.error('Failed to start USSD queue consumer:', error);
    });
  } catch (error) {
    console.error('Failed to initialize USSD queue consumer:', error);
  }

  // Bulk Repayment consumer
  try {
    const bulkService = getBulkRepaymentQueueService();
    console.log('Bulk repayment queue consumer initialized');
    bulkService.startConsuming().catch((error) => {
      console.error('Failed to start bulk repayment consumer:', error);
    });
  } catch (error) {
    console.error('Failed to initialize bulk repayment consumer:', error);
  }

  startBulkRepaymentRecoveryLoop();

  // Bulk Repayment reversal consumer
  try {
    const reversalService = getBulkRepaymentReversalQueueService();
    console.log('Bulk repayment reversal queue consumer initialized');
    reversalService.startConsuming().catch((error) => {
      console.error('Failed to start bulk repayment reversal consumer:', error);
    });
  } catch (error) {
    console.error('Failed to initialize bulk repayment reversal consumer:', error);
  }
}
