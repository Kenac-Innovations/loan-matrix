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
