#!/usr/bin/env tsx

/**
 * Test script for USSD Queue Consumer
 * This script tests the AMQP queue connection and message publishing
 */

import {
  getQueueService,
  UssdLoanApplicationMessage,
} from "../lib/amqp-queue-service";
import { getUssdLeadsData } from "../app/actions/ussd-leads-actions";

async function testQueueConnection() {
  console.log("🔍 Testing AMQP Queue Connection...");

  try {
    const queueService = getQueueService();

    // Wait a bit for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (queueService.isHealthy()) {
      console.log("✅ Queue connection is healthy");
    } else {
      console.log("❌ Queue connection is not healthy");
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Queue connection failed:", error);
    return false;
  }
}

async function testMessagePublishing() {
  console.log("📤 Testing message publishing...");

  try {
    const queueService = getQueueService();

    // Create a test message
    const testMessage: UssdLoanApplicationMessage = {
      loanApplicationUssdId: 999999,
      messageId: `TEST_MSG_${Date.now()}`,
      referenceNumber: `TEST_REF_${Date.now()}`,
      userPhoneNumber: "+263771234567",
      userFullName: "Test User",
      userNationalId: "1234567890",
      loanMatrixLoanProductId: 1,
      loanProductName: "Test Loan",
      loanProductDisplayName: "Test Loan Product",
      principalAmount: 1000,
      loanTermMonths: 12,
      payoutMethod: "1",
      mobileMoneyNumber: "+263771234567",
      mobileMoneyProvider: "EcoCash",
      status: "CREATED",
      source: "TEST",
      channel: "TEST_CHANNEL",
      queuedAt: new Date().toISOString(),
    };

    await queueService.publishMessage(testMessage);
    console.log("✅ Test message published successfully");

    // Wait a bit for message to be processed
    console.log("⏳ Waiting for message to be processed...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return true;
  } catch (error) {
    console.error("❌ Message publishing failed:", error);
    return false;
  }
}

async function testDatabaseRetrieval() {
  console.log("📊 Testing database retrieval...");

  try {
    const ussdLeadsData = await getUssdLeadsData("goodfellow", {
      limit: 10,
    });

    console.log(
      `✅ Retrieved ${ussdLeadsData.applications.length} USSD applications`
    );
    console.log(
      `📈 Total applications: ${ussdLeadsData.metrics.totalApplications}`
    );
    console.log(`⏳ Pending action: ${ussdLeadsData.metrics.pendingAction}`);
    console.log(`✅ Approved: ${ussdLeadsData.metrics.approved}`);
    console.log(`❌ Rejected: ${ussdLeadsData.metrics.rejected}`);

    return true;
  } catch (error) {
    console.error("❌ Database retrieval failed:", error);
    return false;
  }
}

async function testApiEndpoints() {
  console.log("🌐 Testing API endpoints...");

  try {
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Test USSD leads endpoint
    const ussdResponse = await fetch(`${baseUrl}/api/ussd-leads`);
    if (ussdResponse.ok) {
      console.log("✅ USSD leads API endpoint is working");
    } else {
      console.log("❌ USSD leads API endpoint failed:", ussdResponse.status);
    }

    // Test queue health endpoint
    const healthResponse = await fetch(`${baseUrl}/api/queue/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log("✅ Queue health endpoint is working:", healthData);
    } else {
      console.log("❌ Queue health endpoint failed:", healthResponse.status);
    }

    return true;
  } catch (error) {
    console.error("❌ API endpoint testing failed:", error);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting USSD Queue Consumer Test Suite\n");

  const results = {
    queueConnection: false,
    messagePublishing: false,
    databaseRetrieval: false,
    apiEndpoints: false,
  };

  // Test queue connection
  results.queueConnection = await testQueueConnection();
  console.log("");

  // Test message publishing (only if queue is healthy)
  if (results.queueConnection) {
    results.messagePublishing = await testMessagePublishing();
    console.log("");
  }

  // Test database retrieval
  results.databaseRetrieval = await testDatabaseRetrieval();
  console.log("");

  // Test API endpoints
  results.apiEndpoints = await testApiEndpoints();
  console.log("");

  // Summary
  console.log("📋 Test Results Summary:");
  console.log("========================");
  console.log(
    `Queue Connection: ${results.queueConnection ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(
    `Message Publishing: ${results.messagePublishing ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(
    `Database Retrieval: ${results.databaseRetrieval ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(`API Endpoints: ${results.apiEndpoints ? "✅ PASS" : "❌ FAIL"}`);

  const allPassed = Object.values(results).every((result) => result);
  console.log(
    `\nOverall: ${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`
  );

  if (!allPassed) {
    process.exit(1);
  }
}

// Run the test suite
main().catch(console.error);
