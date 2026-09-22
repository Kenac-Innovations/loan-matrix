// Queue consumer initialization
// This module initializes the queue consumers when imported
//
// Bulk repayment processing (repayments + reversals) no longer runs here.
// loan-matrix-be now polls BulkRepaymentItem directly for QUEUED rows and
// posts to Fineract itself — see zw.co.kenac.loanmatrixbe.bulkrepayments.
// This module only remains responsible for the USSD loan application queue.

import { getUssdQueueConsumer } from './ussd-queue-consumer';

// Prevent multiple initializations using global variable
declare global {
  var __queueConsumerInitialized: boolean | undefined;
}

const queueConsumersDisabled =
  process.env.DISABLE_QUEUE_CONSUMERS === "true" ||
  process.env.DISABLE_QUEUE_CONSUMERS === "1";

if (queueConsumersDisabled) {
  console.log("Queue consumers disabled via DISABLE_QUEUE_CONSUMERS");
}

// Initialize the queue consumers only once
if (
  !queueConsumersDisabled &&
  process.env.NODE_ENV !== "test" &&
  !global.__queueConsumerInitialized
) {
  global.__queueConsumerInitialized = true;

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
}
