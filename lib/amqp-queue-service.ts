import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import { PrismaClient } from '@/app/generated/prisma';
import { getTenantBySlug } from './tenant-service';

const prisma = new PrismaClient();

export interface UssdLoanApplicationMessage {
  loanApplicationUssdId: number;
  messageId: string;
  referenceNumber: string;
  userPhoneNumber: string;
  loanMatrixClientId?: number;
  userFullName: string;
  userNationalId: string;
  loanMatrixLoanProductId: number;
  loanProductName: string;
  loanProductDisplayName: string;
  principalAmount: number;
  loanTermMonths: number;
  payoutMethod: string;
  mobileMoneyNumber?: string;
  mobileMoneyProvider?: string;
  branchName?: string;
  officeLocationId?: number;
  bankAccountNumber?: string;
  bankName?: string;
  bankBranch?: string;
  status: string;
  source: string;
  channel: string;
  queuedAt: string;
}

export class AmqpQueueService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds

  constructor() {
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      const amqpUrl = this.buildAmqpUrl();
      console.log('Connecting to AMQP broker...', amqpUrl.replace(/\/\/.*@/, '//***:***@'));
      
      this.connection = await amqp.connect(amqpUrl);
      this.channel = await this.connection.createChannel();
      
      // Set up connection event handlers
      this.connection.on('error', (err) => {
        console.error('AMQP connection error:', err);
        this.isConnected = false;
        this.handleReconnect();
      });

      this.connection.on('close', () => {
        console.log('AMQP connection closed');
        this.isConnected = false;
        this.handleReconnect();
      });

      // Set up channel event handlers
      this.channel.on('error', (err) => {
        console.error('AMQP channel error:', err);
      });

      this.channel.on('close', () => {
        console.log('AMQP channel closed');
      });

      // Set up queue and exchange
      await this.setupQueue();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('Successfully connected to AMQP broker');
      
    } catch (error) {
      console.error('Failed to connect to AMQP broker:', error);
      this.handleReconnect();
    }
  }

  private buildAmqpUrl(): string {
    const host = process.env.AMQP_HOST || '10.10.0.24';
    const port = process.env.AMQP_PORT || '30672';
    const username = process.env.AMQP_USERNAME || 'admin';
    const password = process.env.AMQP_PASSWORD || 'rabbitmq123';
    const vhost = process.env.AMQP_VHOST || '/';
    
    return `amqp://${username}:${password}@${host}:${port}${vhost}`;
  }

  private async setupQueue(): Promise<void> {
    if (!this.channel) throw new Error('Channel not available');

    const exchangeName = process.env.AMQP_EXCHANGE_NAME || 'ussd_exchange';
    const queueName = process.env.AMQP_QUEUE_NAME || 'ussd_loan_applications';
    const routingKey = process.env.AMQP_ROUTING_KEY || 'loan.application';

    // Declare exchange
    await this.channel.assertExchange(exchangeName, 'direct', { durable: true });

    // Declare queue
    await this.channel.assertQueue(queueName, { 
      durable: true,
      arguments: {
        'x-message-ttl': 3600000, // 1 hour TTL
        'x-max-length': 10000, // Max 10k messages
      }
    });

    // Bind queue to exchange
    await this.channel.bindQueue(queueName, exchangeName, routingKey);

    console.log(`Queue setup complete: ${queueName} -> ${exchangeName} (${routingKey})`);
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached. Stopping reconnection attempts.');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms...`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  public async startConsuming(): Promise<void> {
    if (!this.channel || !this.isConnected) {
      throw new Error('Not connected to AMQP broker');
    }

    const queueName = process.env.AMQP_QUEUE_NAME || 'ussd_loan_applications';
    
    // Set prefetch to 1 to process messages one at a time
    await this.channel.prefetch(1);

    console.log(`Starting to consume messages from queue: ${queueName}`);

    await this.channel.consume(queueName, async (msg: ConsumeMessage | null) => {
      if (msg) {
        try {
          await this.processMessage(msg);
          this.channel?.ack(msg);
        } catch (error) {
          console.error('Error processing message:', error);
          // Reject and requeue the message
          this.channel?.nack(msg, false, true);
        }
      }
    });
  }

  private async processMessage(msg: ConsumeMessage): Promise<void> {
    try {
      const messageContent = JSON.parse(msg.content.toString()) as UssdLoanApplicationMessage;
      console.log('Processing USSD loan application:', messageContent.messageId);

      // Get default tenant (you might want to make this configurable)
      const tenant = await getTenantBySlug('default');
      if (!tenant) {
        throw new Error('Default tenant not found');
      }

      // Check if application already exists
      const existingApp = await prisma.ussdLoanApplication.findFirst({
        where: {
          OR: [
            { messageId: messageContent.messageId },
            { referenceNumber: messageContent.referenceNumber },
            { loanApplicationUssdId: messageContent.loanApplicationUssdId }
          ]
        }
      });

      if (existingApp) {
        console.log(`USSD application already exists: ${messageContent.messageId}`);
        return;
      }

      // Create new USSD loan application
      const ussdApplication = await prisma.ussdLoanApplication.create({
        data: {
          tenantId: tenant.id,
          loanApplicationUssdId: messageContent.loanApplicationUssdId,
          messageId: messageContent.messageId,
          referenceNumber: messageContent.referenceNumber,
          userPhoneNumber: messageContent.userPhoneNumber,
          loanMatrixClientId: messageContent.loanMatrixClientId,
          userFullName: messageContent.userFullName,
          userNationalId: messageContent.userNationalId,
          loanMatrixLoanProductId: messageContent.loanMatrixLoanProductId,
          loanProductName: messageContent.loanProductName,
          loanProductDisplayName: messageContent.loanProductDisplayName,
          principalAmount: messageContent.principalAmount,
          loanTermMonths: messageContent.loanTermMonths,
          payoutMethod: messageContent.payoutMethod,
          mobileMoneyNumber: messageContent.mobileMoneyNumber,
          mobileMoneyProvider: messageContent.mobileMoneyProvider,
          branchName: messageContent.branchName,
          officeLocationId: messageContent.officeLocationId,
          bankAccountNumber: messageContent.bankAccountNumber,
          bankName: messageContent.bankName,
          bankBranch: messageContent.bankBranch,
          status: messageContent.status || 'CREATED',
          source: messageContent.source || 'USSD',
          channel: messageContent.channel || 'USSD_LOAN_APPLICATION',
          queuedAt: new Date(messageContent.queuedAt),
          processedAt: new Date(),
        }
      });

      console.log(`Successfully processed USSD application: ${ussdApplication.id} (${ussdApplication.messageId})`);

    } catch (error) {
      console.error('Error processing USSD loan application message:', error);
      throw error;
    }
  }

  public async publishMessage(message: UssdLoanApplicationMessage): Promise<void> {
    if (!this.channel || !this.isConnected) {
      throw new Error('Not connected to AMQP broker');
    }

    const exchangeName = process.env.AMQP_EXCHANGE_NAME || 'ussd_exchange';
    const routingKey = process.env.AMQP_ROUTING_KEY || 'loan.application';

    const messageBuffer = Buffer.from(JSON.stringify(message));
    
    const published = this.channel.publish(
      exchangeName,
      routingKey,
      messageBuffer,
      {
        persistent: true,
        timestamp: Date.now(),
        messageId: message.messageId,
      }
    );

    if (!published) {
      throw new Error('Failed to publish message to queue');
    }

    console.log(`Published message: ${message.messageId}`);
  }

  public async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      this.isConnected = false;
      console.log('AMQP connection closed');
    } catch (error) {
      console.error('Error closing AMQP connection:', error);
    }
  }

  public isHealthy(): boolean {
    return this.isConnected && this.connection !== null && this.channel !== null;
  }
}

// Singleton instance
let queueService: AmqpQueueService | null = null;

export function getQueueService(): AmqpQueueService {
  if (!queueService) {
    queueService = new AmqpQueueService();
  }
  return queueService;
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing AMQP connection...');
  if (queueService) {
    await queueService.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing AMQP connection...');
  if (queueService) {
    await queueService.close();
  }
  process.exit(0);
});
