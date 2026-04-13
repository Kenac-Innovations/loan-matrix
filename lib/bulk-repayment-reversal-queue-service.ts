import amqp, { Channel, Connection, ConsumeMessage } from "amqplib";
import prisma from "./prisma";
import { refreshBulkRepaymentUploadStats } from "./bulk-repayment-upload-stats";
import { undoLoanRepaymentTransaction } from "./bulk-repayment-reverse";

export interface BulkRepaymentReversalMessage {
  itemId: string;
  uploadId: string;
  tenantSlug: string;
  loanId: number;
  fineractTransactionId: string;
  transactionDate: string;
  amount: number;
  reversedBy: string;
}

declare global {
  var __bulkRepaymentReversalConsumerActive: boolean | undefined;
}

const EXCHANGE_NAME =
  process.env.BULK_REPAYMENT_REVERSAL_EXCHANGE || "bulkrepaymentreversals.exchange";
const QUEUE_NAME =
  process.env.BULK_REPAYMENT_REVERSAL_QUEUE || "bulkrepaymentreversals.queue";
const ROUTING_KEY =
  process.env.BULK_REPAYMENT_REVERSAL_ROUTING_KEY || "bulkrepaymentreversals.routing.key";

type QueueAwareError = {
  message?: string;
  errorData?: {
    defaultUserMessage?: string;
    errors?: Array<{ defaultUserMessage?: string }>;
  };
};

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const apiError = error as QueueAwareError;
    return (
      apiError.errorData?.defaultUserMessage ||
      apiError.errorData?.errors?.[0]?.defaultUserMessage ||
      apiError.message ||
      "Unknown error"
    );
  }

  return "Unknown error";
}

export class BulkRepaymentReversalQueueService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected = false;
  private isConsuming = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  public async connect(): Promise<void> {
    try {
      const amqpUrl = this.buildAmqpUrl();
      console.log(
        "[BulkRepaymentReversal] Connecting to AMQP...",
        amqpUrl.replace(/\/\/.*@/, "//***:***@")
      );

      this.connection = await amqp.connect(amqpUrl);
      this.channel = await this.connection.createChannel();

      this.connection.on("error", (err) => {
        console.error("[BulkRepaymentReversal] Connection error:", err.message);
        this.isConnected = false;
        this.handleReconnect();
      });

      this.connection.on("close", () => {
        console.log("[BulkRepaymentReversal] Connection closed");
        this.isConnected = false;
        this.handleReconnect();
      });

      this.channel.on("error", (err) => {
        console.error("[BulkRepaymentReversal] Channel error:", err.message);
      });

      await this.setupQueue();
      this.isConnected = true;
      this.reconnectAttempts = 0;

      console.log("[BulkRepaymentReversal] Connected and queue setup complete");
    } catch (error) {
      console.error("[BulkRepaymentReversal] Failed to connect:", error);
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

    await this.channel.assertExchange(EXCHANGE_NAME, "direct", {
      durable: true,
    });

    await this.channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        "x-message-ttl": 86400000,
      },
    });

    await this.channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

    console.log(
      `[BulkRepaymentReversal] Queue: ${QUEUE_NAME} -> ${EXCHANGE_NAME} (${ROUTING_KEY})`
    );
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[BulkRepaymentReversal] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[BulkRepaymentReversal] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms...`
    );
    setTimeout(() => this.connect(), this.reconnectDelay);
  }

  public async publishReversal(message: BulkRepaymentReversalMessage): Promise<void> {
    if (!this.channel || !this.isConnected) {
      await this.connect();
    }

    if (!this.channel) {
      throw new Error("Unable to connect to AMQP broker");
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    const published = this.channel.publish(EXCHANGE_NAME, ROUTING_KEY, messageBuffer, {
      persistent: true,
      timestamp: Date.now(),
      messageId: `reverse-${message.itemId}`,
    });

    if (!published) {
      throw new Error("Failed to publish reversal message to queue");
    }

    console.log(
      `[BulkRepaymentReversal] Published: ${message.itemId} (loan ${message.loanId})`
    );
  }

  public async startConsuming(): Promise<void> {
    if (global.__bulkRepaymentReversalConsumerActive) {
      console.log("[BulkRepaymentReversal] Consumer already active, skipping");
      return;
    }

    if (this.isConsuming) return;

    if (!this.isConnected) {
      await this.connect();
    }

    let attempts = 0;
    while ((!this.channel || !this.isConnected) && attempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!this.channel || !this.isConnected) {
      throw new Error("Not connected to AMQP broker after waiting");
    }

    await this.channel.prefetch(1);

    console.log(`[BulkRepaymentReversal] Starting consumer on ${QUEUE_NAME}`);

    await this.channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        await this.processMessage(msg);
        this.channel?.ack(msg);
      } catch (error) {
        console.error("[BulkRepaymentReversal] Processing error:", error);
        this.channel?.nack(msg, false, false);
      }
    });

    this.isConsuming = true;
    global.__bulkRepaymentReversalConsumerActive = true;
    console.log("[BulkRepaymentReversal] Consumer started");
  }

  private async processMessage(msg: ConsumeMessage): Promise<void> {
    const message: BulkRepaymentReversalMessage = JSON.parse(msg.content.toString());

    console.log(
      `[BulkRepaymentReversal] Processing: item=${message.itemId} loan=${message.loanId} txn=${message.fineractTransactionId}`
    );

    const item = await prisma.bulkRepaymentItem.findUnique({
      where: { id: message.itemId },
      select: {
        id: true,
        status: true,
        reversalStatus: true,
      },
    });

    if (!item || item.status !== "SUCCESS") {
      console.log(
        `[BulkRepaymentReversal] Skipping ${message.itemId}: item missing or not SUCCESS`
      );
      return;
    }

    if (item.reversalStatus === "REVERSED") {
      console.log(`[BulkRepaymentReversal] Skipping ${message.itemId}: already reversed`);
      return;
    }

    await prisma.bulkRepaymentItem.update({
      where: { id: message.itemId },
      data: {
        reversalStatus: "PROCESSING",
        reversalErrorMessage: null,
      },
    });

    try {
      await undoLoanRepaymentTransaction({
        tenantSlug: message.tenantSlug,
        loanId: message.loanId,
        fineractTransactionId: message.fineractTransactionId,
        transactionDate: new Date(message.transactionDate),
        amount: message.amount,
      });

      await prisma.bulkRepaymentItem.update({
        where: { id: message.itemId },
        data: {
          reversalStatus: "REVERSED",
          reversalErrorMessage: null,
          reversedAt: new Date(),
          reversedBy: message.reversedBy,
        },
      });

      await refreshBulkRepaymentUploadStats(message.uploadId);

      console.log(`[BulkRepaymentReversal] Success: item=${message.itemId}`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);

      await prisma.bulkRepaymentItem.update({
        where: { id: message.itemId },
        data: {
          reversalStatus: "FAILED",
          reversalErrorMessage: errorMessage,
        },
      });

      await refreshBulkRepaymentUploadStats(message.uploadId);

      console.error(
        `[BulkRepaymentReversal] Failed: item=${message.itemId} error=${errorMessage}`
      );
    }
  }

  public async close(): Promise<void> {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      this.isConnected = false;
      global.__bulkRepaymentReversalConsumerActive = false;
      console.log("[BulkRepaymentReversal] Connection closed");
    } catch (error) {
      console.error("[BulkRepaymentReversal] Error closing connection:", error);
    }
  }
}

let service: BulkRepaymentReversalQueueService | null = null;

export function getBulkRepaymentReversalQueueService(): BulkRepaymentReversalQueueService {
  if (!service) {
    service = new BulkRepaymentReversalQueueService();
  }

  return service;
}
