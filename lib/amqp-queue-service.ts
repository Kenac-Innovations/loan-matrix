import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import prisma from './prisma';
import { getTenantBySlug } from './tenant-service';


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
  loanMatrixPaymentMethodId?: number;
}

// Global flag to prevent multiple consumers
declare global {
  var __amqpConsumerActive: boolean | undefined;
}

export class AmqpQueueService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected = false;
  private isConsuming = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds

  constructor() {
    // Don't auto-connect in constructor
  }

  public async connect(): Promise<void> {
    try {
      const amqpUrl = this.buildAmqpUrl();
      console.log(
        "Connecting to AMQP broker...",
        amqpUrl.replace(/\/\/.*@/, "//***:***@")
      );

      this.connection = await amqp.connect(amqpUrl);
      this.channel = await this.connection.createChannel();

      // Set up connection event handlers
      this.connection.on("error", (err) => {
        console.error("AMQP connection error:", err);
        this.isConnected = false;
        this.handleReconnect();
      });

      this.connection.on("close", () => {
        console.log("AMQP connection closed");
        this.isConnected = false;
        this.handleReconnect();
      });

      // Set up channel event handlers
      this.channel.on("error", (err) => {
        console.error("AMQP channel error:", err);
      });

      this.channel.on("close", () => {
        console.log("AMQP channel closed");
      });

      // Set up queue and exchange
      await this.setupQueue();

      this.isConnected = true;
      this.reconnectAttempts = 0;

      console.log('Successfully connected to AMQP broker');
      console.log('Queue service is ready to consume messages');
      
    } catch (error) {
      console.error("Failed to connect to AMQP broker:", error);
      this.handleReconnect();
    }
  }

  private buildAmqpUrl(): string {
    const host = process.env.AMQP_HOST || "10.10.0.24";
    const port = process.env.AMQP_PORT || "30672";
    const username = process.env.AMQP_USERNAME || "admin";
    const password = process.env.AMQP_PASSWORD || "rabbitmq123";
    const vhost = process.env.AMQP_VHOST || "/";

    return `amqp://${username}:${password}@${host}:${port}${vhost}`;
  }

  private async setupQueue(): Promise<void> {
    if (!this.channel) throw new Error("Channel not available");

    const exchangeName =
      process.env.AMQP_EXCHANGE_NAME || "ussdloanapplications.exchange";
    const queueName =
      process.env.AMQP_QUEUE_NAME || "ussdloanapplications.queue";
    const routingKey =
      process.env.AMQP_ROUTING_KEY || "ussdloanapplications.routing.key";

    try {
      // Declare main exchange
      await this.channel.assertExchange(exchangeName, "direct", {
        durable: true,
      });

      // Just check that the queue exists (don't try to modify it)
      await this.channel.checkQueue(queueName);
      console.log(`Using existing queue: ${queueName}`);

      // Bind main queue to main exchange
      await this.channel.bindQueue(queueName, exchangeName, routingKey);

      console.log(
        `Queue setup complete: ${queueName} -> ${exchangeName} (${routingKey})`
      );
    } catch (error) {
      console.error("Error setting up queues:", error);
      throw error;
    }
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        "Max reconnection attempts reached. Stopping reconnection attempts."
      );
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms...`
    );

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  public async startConsuming(): Promise<void> {
    // Prevent multiple consumers globally
    if (global.__amqpConsumerActive) {
      console.log('AMQP consumer already active globally, skipping...');
      return;
    }

    if (this.isConsuming) {
      console.log('Already consuming messages, skipping...');
      return;
    }

    // Ensure connection is established first
    if (!this.isConnected) {
      await this.connect();
    }

    // Wait for connection to be established
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while ((!this.channel || !this.isConnected) && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!this.channel || !this.isConnected) {
      throw new Error("Not connected to AMQP broker after waiting");
    }

    const queueName =
      process.env.AMQP_QUEUE_NAME || "ussdloanapplications.queue";

    // Set prefetch to 1 to process messages one at a time
    await this.channel.prefetch(1);

    console.log(`Starting to consume messages from queue: ${queueName}`);


    await this.channel.consume(queueName, async (msg: ConsumeMessage | null) => {
      console.log('=== CONSUME CALLBACK TRIGGERED ===');
      console.log('Message received:', msg ? 'YES' : 'NO');
      console.log('Queue name:', queueName);
      
      if (msg) {
        console.log('Received message from queue:', queueName);
        console.log('Message properties:', msg.properties);
        console.log('Message routing key:', msg.fields.routingKey);
        try {
          await this.processMessage(msg);
          this.channel?.ack(msg);
          console.log('Message processed and acknowledged successfully');
        } catch (error) {
          console.error('Error processing message:', error);
          // Reject and requeue the message
          this.channel?.nack(msg, false, true);

        }
      } else {
        console.log('No message received from queue:', queueName);
      }
    });

    this.isConsuming = true;
    global.__amqpConsumerActive = true;
    console.log('Consumer started and listening for messages');

  }

  private async processMessage(msg: ConsumeMessage): Promise<void> {
    try {

      // Log raw message before parsing
      console.log('=== RAW MESSAGE FROM QUEUE ===');
      console.log('Raw message content (Buffer):', msg.content);
      console.log('Raw message content (String):', msg.content.toString());
      console.log('Message size (bytes):', msg.content.length);
      console.log('Message properties:', msg.properties);
      console.log('Message fields:', msg.fields);
      console.log('=== END RAW MESSAGE ===');
      
      const messageContent = JSON.parse(msg.content.toString()) as UssdLoanApplicationMessage;
      console.log('Processing USSD loan application:', messageContent.messageId);
      console.log('Full message content received from queue:', JSON.stringify(messageContent, null, 2));


      // Get default tenant (you might want to make this configurable)
      const tenant = await getTenantBySlug("default");
      if (!tenant) {
        throw new Error("Default tenant not found");
      }

      // Check if application already exists
      const existingApp = await prisma.ussdLoanApplication.findFirst({
        where: {
          OR: [
            { messageId: messageContent.messageId },
            { referenceNumber: messageContent.referenceNumber },
            { loanApplicationUssdId: messageContent.loanApplicationUssdId },
          ],
        },
      });

      if (existingApp) {
        console.log(
          `USSD application already exists: ${messageContent.messageId}`
        );
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
          status: messageContent.status || "CREATED",
          source: messageContent.source || "USSD",
          channel: messageContent.channel || "USSD_LOAN_APPLICATION",
          queuedAt: new Date(messageContent.queuedAt),
          processedAt: new Date(),

          loanMatrixPaymentMethodId: messageContent.loanMatrixPaymentMethodId,
        }

      });

      console.log(
        `Successfully processed USSD application: ${ussdApplication.id} (${ussdApplication.messageId})`
      );
    } catch (error) {
      console.error("Error processing USSD loan application message:", error);
      throw error;
    }
  }

  public async publishMessage(
    message: UssdLoanApplicationMessage
  ): Promise<void> {
    if (!this.channel || !this.isConnected) {
      throw new Error("Not connected to AMQP broker");
    }

    const exchangeName = process.env.AMQP_EXCHANGE_NAME || "ussd_exchange";
    const routingKey = process.env.AMQP_ROUTING_KEY || "loan.application";

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
      throw new Error("Failed to publish message to queue");
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
      console.log("AMQP connection closed");
    } catch (error) {
      console.error("Error closing AMQP connection:", error);
    }
  }

  public isHealthy(): boolean {
    return (
      this.isConnected && this.connection !== null && this.channel !== null
    );
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


// Graceful shutdown handler - only add once
if (!process.env.AMQP_SHUTDOWN_HANDLERS_ADDED) {
  process.env.AMQP_SHUTDOWN_HANDLERS_ADDED = 'true';
  
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
}

