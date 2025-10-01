import { getQueueService, UssdLoanApplicationMessage } from '../lib/amqp-queue-service';

async function sendTestMessage() {
  console.log('Sending test message to queue...');
  
  try {
    const queueService = getQueueService();
    
    // Connect to the broker first
    console.log('Connecting to AMQP broker...');
    await queueService.connect();
    
    const testMessage: UssdLoanApplicationMessage = {
      loanApplicationUssdId: 999999,
      messageId: `test-${Date.now()}`,
      referenceNumber: `REF-${Date.now()}`,
      userPhoneNumber: '+1234567890',
      loanMatrixClientId: 1,
      userFullName: 'Test User',
      userNationalId: '123456789',
      loanMatrixLoanProductId: 1,
      loanProductName: 'Test Product',
      loanProductDisplayName: 'Test Product Display',
      principalAmount: 1000,
      loanTermMonths: 12,
      payoutMethod: 'MOBILE_MONEY',
      mobileMoneyNumber: '+1234567890',
      mobileMoneyProvider: 'Test Provider',
      branchName: 'Test Branch',
      officeLocationId: 1,
      bankAccountNumber: '1234567890',
      bankName: 'Test Bank',
      bankBranch: 'Test Branch',
      status: 'CREATED',
      source: 'USSD',
      channel: 'USSD_LOAN_APPLICATION',
      queuedAt: new Date().toISOString(),
      loanMatrixPaymentMethodId: 4, // This is the key field we want to test
    };
    
    await queueService.publishMessage(testMessage);
    console.log('Test message sent successfully!');
    console.log('Message content:', JSON.stringify(testMessage, null, 2));
    
  } catch (error) {
    console.error('Error sending test message:', error);
  }
}

sendTestMessage();
