// This component initializes the queue consumer on the server side
// It should be imported in a server component to ensure it runs on the server

import { getUssdQueueConsumer } from '@/lib/ussd-queue-consumer';

export function QueueInitializer() {
  // This component doesn't render anything, it just initializes the queue consumer
  // The actual initialization happens in the ussd-queue-consumer module when imported
  return null;
}

// Initialize the queue consumer when this module is imported
if (process.env.NODE_ENV !== 'test') {
  try {
    getUssdQueueConsumer();
    console.log('Queue consumer initialized');
  } catch (error) {
    console.error('Failed to initialize queue consumer:', error);
  }
}
