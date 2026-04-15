import amqp, { Channel, Connection, ConsumeMessage } from "amqplib";
import prisma from "./prisma";
import { undoLoanRepaymentTransaction } from "./bulk-repayment-reverse";
import { updateBulkRepaymentUploadCounters } from "./bulk-repayment-upload-stats";

export interface BulkRepaymentReversalMessage {
  itemId: string;
  uploadId: string;
  tenantSlug: string;
  loanId: number;
  fineractTxnId: string;
  transactionDate: string;
  requestedBy: string;
}

interface FineractApiError extends Error {
  errorData?: {
    defaultUserMessage?: string;
    errors?: Array<{
      defaultUserMessage?: string;
    }>;
  };
}

declare global {
  var __bulkRepaymentReversalConsumerActive: boolean | undefined;
}

const EXCHANGE_NAME =
  process.env.BULK_REPAYMENT_REVERSE_EXCHANGE ||
  "bulkrepayments.reverse.exchange";
const QUEUE_NAME =
  process.env.BULK_REPAYMENT_REVERSE_QUEUE || "bulkrepayments.reverse.queue";
const ROUTING_KEY =
  process.env.BULK_REPAYMENT_REVERSE_ROUTING_KEY ||
  "bulkrepayments.reverse.routing.key";

export class BulkRepaymentReversalQueueService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private isConnected = false;
  private isConsuming = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 5000;

  public async connect(): Promise<void> {
    try {
      const amqpUrl = this.buildAmqpUrl();
      console.log(
        "[BulkRepaymentReverse] Connecting to AMQP...",
        amqpUrl.replace(/\/\/.*@/, "//***:***@")
      );

      this.connection = await amqp.connect(amqpUrl);
      this.channel = await this.connection.createChannel();

      this.connection.on("error", (err) => {
        console.error("[BulkRepaymentReverse] Connection error:", err.message);
        this.isConnected = false;
        this.handleReconnect();
      });

      this.connection.on("close", () => {
        console.log("[BulkRepaymentReverse] Connection closed");
        this.isConnected = false;
        this.handleReconnect();
      });

      this.channel.on("error", (err) => {
        console.error("[BulkRepaymentReverse] Channel error:", err.message);
      });

      await this.setupQueue();
      this.isConnected = true;
      this.reconnectAttempts = 0;

      console.log("[BulkRepaymentReverse] Connected and queue setup complete");
    } catch (error) {
      console.error("[BulkRepaymentReverse] Failed to connect:", error);
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
      `[BulkRepaymentReverse] Queue: ${QUEUE_NAME} -> ${EXCHANGE_NAME} (${ROUTING_KEY})`
    );
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[BulkRepaymentReverse] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts += 1;
    console.log(
      `[BulkRepaymentReverse] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms...`
    );
    setTimeout(() => this.connect(), this.reconnectDelay);
  }

  public async publishReversal(
    message: BulkRepaymentReversalMessage
  ): Promise<void> {
    if (!this.channel || !this.isConnected) {
      await this.connect();
    }

    if (!this.channel) {
      throw new Error("Unable to connect to AMQP broker");
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    const published = this.channel.publish(
      EXCHANGE_NAME,
      ROUTING_KEY,
      messageBuffer,
      {
        persistent: true,
        timestamp: Date.now(),
        messageId: `reverse:${message.itemId}`,
      }
    );

    if (!published) {
      throw new Error("Failed to publish reversal message to queue");
    }

    console.log(
      `[BulkRepaymentReverse] Published: ${message.itemId} (loan ${message.loanId})`
    );
  }

  public async startConsuming(): Promise<void> {
    if (global.__bulkRepaymentReversalConsumerActive) {
      console.log("[BulkRepaymentReverse] Consumer already active, skipping");
      return;
    }

    if (this.isConsuming) return;

    if (!this.isConnected) {
      await this.connect();
    }

    let attempts = 0;
    while ((!this.channel || !this.isConnected) && attempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts += 1;
    }

    if (!this.channel || !this.isConnected) {
      throw new Error("Not connected to AMQP broker after waiting");
    }

    await this.channel.prefetch(1);

    console.log(`[BulkRepaymentReverse] Starting consumer on ${QUEUE_NAME}`);

    await this.channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        await this.processMessage(msg);
        this.channel?.ack(msg);
      } catch (error) {
        console.error("[BulkRepaymentReverse] Processing error:", error);
        this.channel?.nack(msg, false, false);
      }
    });

    this.isConsuming = true;
    global.__bulkRepaymentReversalConsumerActive = true;
    console.log("[BulkRepaymentReverse] Consumer started");
  }

  private async processMessage(msg: ConsumeMessage): Promise<void> {
    const message: BulkRepaymentReversalMessage = JSON.parse(
      msg.content.toString()
    );

    console.log(
      `[BulkRepaymentReverse] Processing: item=${message.itemId} loan=${message.loanId} txn=${message.fineractTxnId}`
    );

    const item = await prisma.bulkRepaymentItem.findUnique({
      where: { id: message.itemId },
      select: {
        id: true,
        status: true,
        reversalStatus: true,
      },
    });

    if (!item) {
      console.warn(
        `[BulkRepaymentReverse] Item ${message.itemId} no longer exists, skipping`
      );
      return;
    }

    if (item.status !== "SUCCESS" || item.reversalStatus !== "QUEUED") {
      console.log(
        `[BulkRepaymentReverse] Skipping item ${message.itemId}; status=${item.status} reversalStatus=${item.reversalStatus}`
      );
      return;
    }

    await prisma.bulkRepaymentItem.update({
      where: { id: message.itemId },
      data: {
        reversalStatus: "PROCESSING",
        reversalErrorMessage: null,
      },
    });
    await updateBulkRepaymentUploadCounters(message.uploadId);

    try {
      await undoLoanRepaymentTransaction({
        tenantSlug: message.tenantSlug,
        loanId: message.loanId,
        fineractTransactionId: message.fineractTxnId,
        transactionDate: new Date(message.transactionDate),
      });

      await prisma.bulkRepaymentItem.update({
        where: { id: message.itemId },
        data: {
          status: "REVERSED",
          reversalStatus: "REVERSED",
          reversalErrorMessage: null,
          reversedAt: new Date(),
          reversedBy: message.requestedBy,
        },
      });

      console.log(`[BulkRepaymentReverse] Success: item=${message.itemId}`);
    } catch (error: unknown) {
      const fineractError = error as FineractApiError;
      const errorMessage =
        fineractError.errorData?.defaultUserMessage ||
        fineractError.errorData?.errors?.[0]?.defaultUserMessage ||
        fineractError.message ||
        "Unknown error";

      await prisma.bulkRepaymentItem.update({
        where: { id: message.itemId },
        data: {
          reversalStatus: "FAILED",
          reversalErrorMessage: errorMessage,
        },
      });

      console.error(
        `[BulkRepaymentReverse] Failed: item=${message.itemId} error=${errorMessage}`
      );
    }

    await updateBulkRepaymentUploadCounters(message.uploadId);
  }
}

let service: BulkRepaymentReversalQueueService | null = null;

export function getBulkRepaymentReversalQueueService(): BulkRepaymentReversalQueueService {
  if (!service) {
    service = new BulkRepaymentReversalQueueService();
  }
  return service;
}
