// Queue consumer initialization
// This module initializes the queue consumer when imported

import { getUssdQueueConsumer } from './ussd-queue-consumer';

// Prevent multiple initializations using global variable
declare global {
  var __queueConsumerInitialized: boolean | undefined;
}

// Initialize the queue consumer only once
if (process.env.NODE_ENV !== 'test' && !global.__queueConsumerInitialized) {
  global.__queueConsumerInitialized = true;
  try {
    const consumer = getUssdQueueConsumer();
    console.log('Queue consumer initialized');
    
    // Start the consumer
    consumer.start().catch((error) => {
      console.error('Failed to start queue consumer:', error);
    });
  } catch (error) {
    console.error('Failed to initialize queue consumer:', error);
  }
}
