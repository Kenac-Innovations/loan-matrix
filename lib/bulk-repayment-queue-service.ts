import amqp, { Connection, Channel, ConsumeMessage } from "amqplib";
import prisma from "./prisma";
import { fetchFineractAPI } from "./api";

export interface BulkRepaymentMessage {
  itemId: string;
  uploadId: string;
  loanId: number;
  amount: number;
  transactionDate: string;
  paymentTypeId?: number;
  accountNumber?: string;
  chequeNumber?: string;
  routingCode?: string;
  receiptNumber?: string;
  bankNumber?: string;
  note?: string;
  locale: string;
  dateFormat: string;
}

declare global {
  var __bulkRepaymentConsumerActive: boolean | undefined;
}

const EXCHANGE_NAME =
  process.env.BULK_REPAYMENT_EXCHANGE || "bulkrepayments.exchange";
const QUEUE_NAME =
  process.env.BULK_REPAYMENT_QUEUE || "bulkrepayments.queue";
const ROUTING_KEY =
  process.env.BULK_REPAYMENT_ROUTING_KEY || "bulkrepayments.routing.key";

export class BulkRepaymentQueueService {
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
        "[BulkRepayment] Connecting to AMQP...",
        amqpUrl.replace(/\/\/.*@/, "//***:***@")
      );

      this.connection = await amqp.connect(amqpUrl);
      this.channel = await this.connection.createChannel();

      this.connection.on("error", (err) => {
        console.error("[BulkRepayment] Connection error:", err.message);
        this.isConnected = false;
        this.handleReconnect();
      });

      this.connection.on("close", () => {
        console.log("[BulkRepayment] Connection closed");
        this.isConnected = false;
        this.handleReconnect();
      });

      this.channel.on("error", (err) => {
        console.error("[BulkRepayment] Channel error:", err.message);
      });

      await this.setupQueue();
      this.isConnected = true;
      this.reconnectAttempts = 0;

      console.log("[BulkRepayment] Connected and queue setup complete");
    } catch (error) {
      console.error("[BulkRepayment] Failed to connect:", error);
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
        "x-message-ttl": 86400000, // 24h TTL
      },
    });

    await this.channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

    console.log(
      `[BulkRepayment] Queue: ${QUEUE_NAME} -> ${EXCHANGE_NAME} (${ROUTING_KEY})`
    );
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[BulkRepayment] Max reconnection attempts reached");
      return;
    }
    this.reconnectAttempts++;
    console.log(
      `[BulkRepayment] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms...`
    );
    setTimeout(() => this.connect(), this.reconnectDelay);
  }

  public async publishRepayment(
    message: BulkRepaymentMessage
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
        messageId: message.itemId,
      }
    );

    if (!published) {
      throw new Error("Failed to publish message to queue");
    }

    console.log(`[BulkRepayment] Published: ${message.itemId} (loan ${message.loanId})`);
  }

  public async startConsuming(): Promise<void> {
    if (global.__bulkRepaymentConsumerActive) {
      console.log("[BulkRepayment] Consumer already active, skipping");
      return;
    }

    if (this.isConsuming) return;

    if (!this.isConnected) {
      await this.connect();
    }

    let attempts = 0;
    while ((!this.channel || !this.isConnected) && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      attempts++;
    }

    if (!this.channel || !this.isConnected) {
      throw new Error("Not connected to AMQP broker after waiting");
    }

    await this.channel.prefetch(3);

    console.log(`[BulkRepayment] Starting consumer on ${QUEUE_NAME}`);

    await this.channel.consume(
      QUEUE_NAME,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;
        try {
          await this.processMessage(msg);
          this.channel?.ack(msg);
        } catch (error) {
          console.error("[BulkRepayment] Processing error:", error);
          this.channel?.nack(msg, false, false); // Don't requeue, mark as failed
        }
      }
    );

    this.isConsuming = true;
    global.__bulkRepaymentConsumerActive = true;
    console.log("[BulkRepayment] Consumer started");
  }

  private async processMessage(msg: ConsumeMessage): Promise<void> {
    const message: BulkRepaymentMessage = JSON.parse(
      msg.content.toString()
    );

    console.log(
      `[BulkRepayment] Processing: item=${message.itemId} loan=${message.loanId} amount=${message.amount}`
    );

    // Mark as PROCESSING
    await prisma.bulkRepaymentItem.update({
      where: { id: message.itemId },
      data: { status: "PROCESSING" },
    });

    try {
      // Build Fineract repayment body
      const repaymentBody: any = {
        dateFormat: message.dateFormat,
        locale: message.locale,
        transactionDate: message.transactionDate,
        transactionAmount: message.amount,
        note: message.note || "Bulk repayment",
      };

      if (message.paymentTypeId) {
        repaymentBody.paymentTypeId = message.paymentTypeId;
      }

      if (message.accountNumber) repaymentBody.accountNumber = message.accountNumber;
      if (message.chequeNumber) repaymentBody.chequeNumber = message.chequeNumber;
      if (message.routingCode) repaymentBody.routingCode = message.routingCode;
      if (message.receiptNumber) repaymentBody.receiptNumber = message.receiptNumber;
      if (message.bankNumber) repaymentBody.bankNumber = message.bankNumber;

      const result = await fetchFineractAPI(
        `/loans/${message.loanId}/transactions?command=repayment`,
        {
          method: "POST",
          body: JSON.stringify(repaymentBody),
        }
      );

      // Success
      await prisma.bulkRepaymentItem.update({
        where: { id: message.itemId },
        data: {
          status: "SUCCESS",
          fineractTxnId: result.resourceId
            ? String(result.resourceId)
            : result.transactionId
              ? String(result.transactionId)
              : null,
          processedAt: new Date(),
          errorMessage: null,
        },
      });

      // Update upload counters
      await this.updateUploadCounters(message.uploadId);

      console.log(
        `[BulkRepayment] Success: item=${message.itemId} txnId=${result.resourceId || result.transactionId}`
      );
    } catch (error: any) {
      const errorMsg =
        error.errorData?.defaultUserMessage ||
        error.errorData?.errors?.[0]?.defaultUserMessage ||
        error.message ||
        "Unknown error";

      await prisma.bulkRepaymentItem.update({
        where: { id: message.itemId },
        data: {
          status: "FAILED",
          errorMessage: errorMsg,
          processedAt: new Date(),
        },
      });

      await this.updateUploadCounters(message.uploadId);

      console.error(
        `[BulkRepayment] Failed: item=${message.itemId} error=${errorMsg}`
      );
    }
  }

  private async updateUploadCounters(uploadId: string): Promise<void> {
    try {
      const counts = await prisma.bulkRepaymentItem.groupBy({
        by: ["status"],
        where: { uploadId },
        _count: { status: true },
      });

      const countMap: Record<string, number> = {};
      counts.forEach((c) => {
        countMap[c.status] = c._count.status;
      });

      const successCount = countMap["SUCCESS"] || 0;
      const failedCount = countMap["FAILED"] || 0;
      const queuedCount = (countMap["QUEUED"] || 0) + (countMap["PROCESSING"] || 0);
      const totalProcessed = successCount + failedCount;

      const upload = await prisma.bulkRepaymentUpload.findUnique({
        where: { id: uploadId },
        select: { totalRows: true },
      });

      const isComplete = upload && totalProcessed >= upload.totalRows;

      await prisma.bulkRepaymentUpload.update({
        where: { id: uploadId },
        data: {
          successCount,
          failedCount,
          queuedCount,
          status: isComplete ? "COMPLETED" : "PROCESSING",
        },
      });
    } catch (err) {
      console.error("[BulkRepayment] Failed to update counters:", err);
    }
  }

  public async close(): Promise<void> {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      this.isConnected = false;
      global.__bulkRepaymentConsumerActive = false;
      console.log("[BulkRepayment] Connection closed");
    } catch (error) {
      console.error("[BulkRepayment] Error closing connection:", error);
    }
  }

  public isHealthy(): boolean {
    return this.isConnected && this.connection !== null && this.channel !== null;
  }
}

// Singleton
let service: BulkRepaymentQueueService | null = null;

export function getBulkRepaymentQueueService(): BulkRepaymentQueueService {
  if (!service) {
    service = new BulkRepaymentQueueService();
  }
  return service;
}
