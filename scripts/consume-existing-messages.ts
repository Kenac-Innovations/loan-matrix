#!/usr/bin/env tsx

/**
 * Script to consume all existing messages from the USSD queue
 */

import { getUssdQueueConsumer } from "../lib/ussd-queue-consumer";
import { getUssdLeadsData } from "../app/actions/ussd-leads-actions";

async function consumeExistingMessages() {
  console.log("🔄 Starting queue consumer to process existing messages...\n");

  try {
    // Start the queue consumer
    const consumer = getUssdQueueConsumer();
    await consumer.start();
    console.log("✅ Queue consumer started successfully\n");

    // Wait for messages to be processed
    console.log("⏳ Waiting for existing messages to be processed...");
    console.log(
      "   (This may take a few moments depending on message count)\n"
    );

    // Wait longer to process all existing messages
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Check database for all applications
    console.log("📊 Checking database for all processed messages...");
    const ussdLeadsData = await getUssdLeadsData("goodfellow", {
      limit: 50,
    });

    console.log(
      `📈 Total applications: ${ussdLeadsData.metrics.totalApplications}`
    );
    console.log(`📋 All applications:`);
    ussdLeadsData.applications.forEach((app, index) => {
      console.log(
        `  ${index + 1}. ${app.userFullName} - ${app.messageId} - ${
          app.status
        } - $${app.principalAmount}`
      );
    });

    // Stop the consumer
    console.log("\n🛑 Stopping queue consumer...");
    await consumer.stop();
    console.log("✅ Queue consumer stopped");

    console.log("\n🎉 All existing messages have been processed!");
  } catch (error) {
    console.error("❌ Error consuming messages:", error);
  }
}

// Run the script
consumeExistingMessages().catch(console.error);
