import { getQueueService } from '../lib/amqp-queue-service';

async function checkQueueMessages() {
  console.log('Checking for messages in the queue...');
  
  try {
    const queueService = getQueueService();
    
    // Start consuming to see if there are any messages
    await queueService.startConsuming();
    
    console.log('Queue consumer started. Waiting for messages...');
    console.log('If no messages appear in 30 seconds, there are no messages in the queue.');
    
    // Keep the process alive for 30 seconds to see if messages come through
    setTimeout(() => {
      console.log('30 seconds elapsed. No messages received.');
      process.exit(0);
    }, 30000);
    
  } catch (error) {
    console.error('Error checking queue messages:', error);
    process.exit(1);
  }
}

checkQueueMessages();
