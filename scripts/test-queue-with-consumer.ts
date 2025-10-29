#!/usr/bin/env tsx

/**
 * Test script for USSD Queue Consumer with manual consumer start
 * This script starts the consumer and then tests message processing
 */

import { getUssdQueueConsumer } from "../lib/ussd-queue-consumer";
import {
  getQueueService,
  UssdLoanApplicationMessage,
} from "../lib/amqp-queue-service";
import { getUssdLeadsData } from "../app/actions/ussd-leads-actions";

async function testQueueWithConsumer() {
  console.log("🚀 Starting USSD Queue Test with Consumer...\n");

  try {
    // Start the queue consumer
    console.log("🔄 Starting queue consumer...");
    const consumer = getUssdQueueConsumer();
    await consumer.start();
    console.log("✅ Queue consumer started successfully\n");

    // Wait a moment for consumer to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test publishing a message
    console.log("📤 Publishing test message...");
    const queueService = getQueueService();

    const testMessage: UssdLoanApplicationMessage = {
      loanApplicationUssdId: Math.floor(Math.random() * 1000000),
      messageId: `TEST_MSG_${Date.now()}`,
      referenceNumber: `TEST_REF_${Date.now()}`,
      userPhoneNumber: "+263771234567",
      userFullName: "Test User Consumer",
      userNationalId: "1234567890",
      loanMatrixLoanProductId: 1,
      loanProductName: "Test Loan",
      loanProductDisplayName: "Test Loan Product",
      principalAmount: 1500,
      loanTermMonths: 12,
      payoutMethod: "1",
      mobileMoneyNumber: "+263771234567",
      mobileMoneyProvider: "EcoCash",
      status: "CREATED",
      source: "USSD",
      channel: "USSD_LOAN_APPLICATION",
      queuedAt: new Date().toISOString(),
    };

    await queueService.publishMessage(testMessage);
    console.log(`✅ Test message published: ${testMessage.messageId}\n`);

    // Wait for message to be processed
    console.log("⏳ Waiting for message to be processed...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check database
    console.log("📊 Checking database for processed message...");
    const ussdLeadsData = await getUssdLeadsData("goodfellow", { limit: 10 });

    console.log(
      `📈 Total applications: ${ussdLeadsData.metrics.totalApplications}`
    );
    console.log(`📋 Recent applications:`);
    ussdLeadsData.applications.forEach((app, index) => {
      console.log(
        `  ${index + 1}. ${app.userFullName} - ${app.messageId} - ${
          app.status
        } - $${app.principalAmount}`
      );
    });

    // Check if our test message was processed
    const testApp = ussdLeadsData.applications.find(
      (app) => app.messageId === testMessage.messageId
    );
    if (testApp) {
      console.log(
        "\n✅ SUCCESS: Test message was processed and stored in database!"
      );
      console.log(`   Message ID: ${testApp.messageId}`);
      console.log(`   Status: ${testApp.status}`);
      console.log(`   Amount: $${testApp.principalAmount}`);
    } else {
      console.log("\n❌ FAILED: Test message was not found in database");
    }

    // Stop the consumer
    console.log("\n🛑 Stopping queue consumer...");
    await consumer.stop();
    console.log("✅ Queue consumer stopped");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testQueueWithConsumer().catch(console.error);
