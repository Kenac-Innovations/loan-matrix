import https from "https";
import amqp, { Connection, Channel, ConsumeMessage } from "amqplib";
import prisma from "./prisma";
import { refreshBulkRepaymentUploadStats } from "./bulk-repayment-upload-stats";

export interface BulkRepaymentMessage {
  itemId: string;
  uploadId: string;
  tenantSlug: string;
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

type RepaymentBody = {
  dateFormat: string;
  locale: string;
  transactionDate: string;
  transactionAmount: number;
  note: string;
  paymentTypeId?: number;
  accountNumber?: string;
  chequeNumber?: string;
  routingCode?: string;
  receiptNumber?: string;
  bankNumber?: string;
};

type FineractRepaymentResponse = {
  resourceId?: string | number;
  transactionId?: string | number;
};

type FineractQueueError = {
  message?: string;
  errorData?: {
    defaultUserMessage?: string;
    errors?: Array<{ defaultUserMessage?: string }>;
  };
};

type FineractErrorPayload = {
  errors?: Array<{ defaultUserMessage?: string }>;
  defaultUserMessage?: string;
};

function getQueueErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const queueError = error as FineractQueueError;
    return (
      queueError.errorData?.defaultUserMessage ||
      queueError.errorData?.errors?.[0]?.defaultUserMessage ||
      queueError.message ||
      "Unknown error"
    );
  }

  return "Unknown error";
}

declare global {
  var __bulkRepaymentConsumerActive: boolean | undefined;
}

interface BulkRepaymentQueueConfig {
  exchangeName: string;
  queueName: string;
  routingKey: string;
}

function getQueueConfig(): BulkRepaymentQueueConfig {
  return {
    exchangeName:
      process.env.BULK_REPAYMENT_EXCHANGE || "bulkrepayments.prod.exchange",
    queueName: process.env.BULK_REPAYMENT_QUEUE || "bulkrepayments.prod.queue",
    routingKey:
      process.env.BULK_REPAYMENT_ROUTING_KEY ||
      "bulkrepayments.prod.routing.key",
  };
}

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
    const { exchangeName, queueName, routingKey } = getQueueConfig();

    await this.channel.assertExchange(exchangeName, "direct", {
      durable: true,
    });

    await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        "x-message-ttl": 86400000, // 24h TTL
      },
    });

    await this.channel.bindQueue(queueName, exchangeName, routingKey);

    console.log(
      `[BulkRepayment] Queue: ${queueName} -> ${exchangeName} (${routingKey})`
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
    const { exchangeName, routingKey } = getQueueConfig();

    if (!this.channel || !this.isConnected) {
      await this.connect();
    }

    if (!this.channel) {
      throw new Error("Unable to connect to AMQP broker");
    }

    const messageBuffer = Buffer.from(JSON.stringify(message));
    const published = this.channel.publish(
      exchangeName,
      routingKey,
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
    const { queueName } = getQueueConfig();

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

    console.log(`[BulkRepayment] Starting consumer on ${queueName}`);

    await this.channel.consume(
      queueName,
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
      const repaymentBody: RepaymentBody = {
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

      const result = await this.callFineractAPI(
        message.tenantSlug,
        `/loans/${message.loanId}/transactions?command=repayment`,
        repaymentBody
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

      await refreshBulkRepaymentUploadStats(message.uploadId);

      console.log(
        `[BulkRepayment] Success: item=${message.itemId} txnId=${result.resourceId || result.transactionId}`
      );
    } catch (error: unknown) {
      const errorMsg = getQueueErrorMessage(error);

      await prisma.bulkRepaymentItem.update({
        where: { id: message.itemId },
        data: {
          status: "FAILED",
          errorMessage: errorMsg,
          processedAt: new Date(),
        },
      });

      await refreshBulkRepaymentUploadStats(message.uploadId);

      console.error(
        `[BulkRepayment] Failed: item=${message.itemId} error=${errorMsg}`
      );
    }
  }

  private async callFineractAPI(
    tenantSlug: string,
    endpoint: string,
    body: RepaymentBody
  ): Promise<FineractRepaymentResponse> {
    const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";
    const serviceToken = process.env.FINERACT_SERVICE_TOKEN || "bWlmb3M6cGFzc3dvcmQ=";
    const fineractTenantId = tenantSlug || process.env.FINERACT_TENANT_ID || "goodfellow";

    const url = `${baseUrl}/fineract-provider/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Basic ${serviceToken}`,
      "Fineract-Platform-TenantId": fineractTenantId,
    };

    const fetchOptions: RequestInit = { method: "POST", headers, body: JSON.stringify(body) };

    let response;
    if (url.startsWith("http://")) {
      response = await fetch(url, fetchOptions);
    } else {
      const agent = new https.Agent({ rejectUnauthorized: false });
      response = await fetch(url, { ...fetchOptions, ...({ agent } as { agent: unknown }) });
    }

    if (!response.ok) {
      let errorData: FineractErrorPayload = {};
      try {
        errorData = (await response.json()) as FineractErrorPayload;
      } catch {
        errorData = {};
      }

      const msg =
        errorData?.errors?.[0]?.defaultUserMessage ||
        errorData?.defaultUserMessage ||
        `HTTP ${response.status}: ${response.statusText}`;

      const error = new Error(`API error: ${response.status} ${response.statusText}`);
      (
        error as Error & {
          status: number;
          errorData: FineractErrorPayload;
        }
      ).status = response.status;
      (
        error as Error & {
          status: number;
          errorData: FineractErrorPayload;
        }
      ).errorData = { ...errorData, defaultUserMessage: msg };
      throw error;
    }

    return (await response.json()) as FineractRepaymentResponse;
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
