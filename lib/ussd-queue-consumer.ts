import { getQueueService } from './amqp-queue-service';

export class UssdQueueConsumer {
  private isRunning = false;
  private queueService = getQueueService();

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('USSD queue consumer is already running');
      return;
    }

    try {
      console.log('Starting USSD queue consumer...');
      
      // Start consuming messages
      await this.queueService.startConsuming();
      
      this.isRunning = true;
      console.log('USSD queue consumer started successfully');
      
    } catch (error) {
      console.error('Failed to start USSD queue consumer:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('USSD queue consumer is not running');
      return;
    }

    try {
      console.log('Stopping USSD queue consumer...');
      await this.queueService.close();
      this.isRunning = false;
      console.log('USSD queue consumer stopped successfully');
    } catch (error) {
      console.error('Error stopping USSD queue consumer:', error);
      throw error;
    }
  }

  public isHealthy(): boolean {
    return this.isRunning && this.queueService.isHealthy();
  }

  public getStatus(): {
    isRunning: boolean;
    isHealthy: boolean;
    queueHealthy: boolean;
  } {
    return {
      isRunning: this.isRunning,
      isHealthy: this.isHealthy(),
      queueHealthy: this.queueService.isHealthy(),
    };
  }
}

// Singleton instance
let consumer: UssdQueueConsumer | null = null;

export function getUssdQueueConsumer(): UssdQueueConsumer {
  if (!consumer) {
    consumer = new UssdQueueConsumer();
  }
  return consumer;
}

// Consumer will be started by the queue-initializer module
