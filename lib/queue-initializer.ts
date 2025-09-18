// Queue consumer initialization
// This module initializes the queue consumer when imported

import { getUssdQueueConsumer } from './ussd-queue-consumer';

// Initialize the queue consumer
if (process.env.NODE_ENV !== 'test') {
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
