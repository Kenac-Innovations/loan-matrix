// Queue consumer initialization
// This module initializes the queue consumers when imported

import { getUssdQueueConsumer } from './ussd-queue-consumer';
import { getBulkRepaymentQueueService } from './bulk-repayment-queue-service';
import { getBulkRepaymentReversalQueueService } from './bulk-repayment-reversal-queue-service';

// Prevent multiple initializations using global variable
declare global {
  var __queueConsumerInitialized: boolean | undefined;
}

// Initialize the queue consumers only once
if (process.env.NODE_ENV !== 'test' && !global.__queueConsumerInitialized) {
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
