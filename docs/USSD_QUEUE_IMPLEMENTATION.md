# USSD Queue Implementation

## Overview

This document describes the implementation of AMQP queue consumption for USSD loan applications. The system now consumes loan applications from a RabbitMQ queue instead of using dummy data.

## Architecture

### Components

1. **AMQP Queue Service** (`lib/amqp-queue-service.ts`)
   - Handles connection to RabbitMQ broker
   - Manages message publishing and consuming
   - Includes automatic reconnection logic
   - Processes USSD loan application messages

2. **USSD Queue Consumer** (`lib/ussd-queue-consumer.ts`)
   - Wraps the AMQP service for USSD-specific functionality
   - Auto-starts when the application starts
   - Provides health monitoring

3. **Database Schema** (`prisma/schema.prisma`)
   - New `UssdLoanApplication` model
   - Stores queue-processed loan applications
   - Includes comprehensive indexing for performance

4. **Updated Actions** (`app/actions/ussd-leads-actions.ts`)
   - Now queries from database instead of generating dummy data
   - Real-time metrics calculation
   - Status update functionality

5. **API Endpoints**
   - `GET /api/ussd-leads` - Fetch USSD applications
   - `PUT /api/ussd-leads/[id]/status` - Update application status
   - `GET /api/queue/health` - Check queue health

## Configuration

### Environment Variables

Add these to your `env.local` file:

```env
# AMQP Queue Configuration for USSD Leads
AMQP_HOST=10.10.0.24
AMQP_PORT=30672
AMQP_USERNAME=admin
AMQP_PASSWORD=rabbitmq123
AMQP_VHOST=/
AMQP_QUEUE_NAME=ussd_loan_applications
AMQP_EXCHANGE_NAME=ussd_exchange
AMQP_ROUTING_KEY=loan.application
```

### Queue Setup

The system automatically:
- Connects to the AMQP broker
- Declares the exchange and queue
- Sets up message routing
- Starts consuming messages

## Message Format

USSD loan applications are expected in this JSON format:

```json
{
  "loanApplicationUssdId": 12345,
  "messageId": "MSG123456",
  "referenceNumber": "REF12345678",
  "userPhoneNumber": "+263771234567",
  "userFullName": "John Doe",
  "userNationalId": "1234567890",
  "loanMatrixLoanProductId": 1,
  "loanProductName": "Personal Loan",
  "loanProductDisplayName": "Personal Loan - Up to $500",
  "principalAmount": 1000,
  "loanTermMonths": 12,
  "payoutMethod": "1",
  "mobileMoneyNumber": "+263771234567",
  "mobileMoneyProvider": "EcoCash",
  "status": "CREATED",
  "source": "USSD",
  "channel": "USSD_LOAN_APPLICATION",
  "queuedAt": "2024-01-15T10:30:00Z"
}
```

## Features

### Real-time Processing
- Messages are consumed as soon as they arrive
- Automatic duplicate detection prevents processing the same application twice
- Failed messages are requeued for retry

### Health Monitoring
- Queue connection health checks
- Automatic reconnection on connection loss
- Health endpoint for monitoring

### Data Persistence
- All applications are stored in the database
- Comprehensive audit trail
- Status tracking and processing notes

### Performance
- Database indexes for fast queries
- Pagination support
- Efficient metrics calculation

## Testing

Run the test suite to verify the implementation:

```bash
npx tsx scripts/test-queue.ts
```

The test suite checks:
- Queue connection health
- Message publishing and consumption
- Database operations
- API endpoint functionality

## Monitoring

### Queue Health
Check the queue health at: `GET /api/queue/health`

Response:
```json
{
  "queue": {
    "isRunning": true,
    "isHealthy": true,
    "queueHealthy": true
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Application Metrics
The system provides real-time metrics:
- Total applications
- Pending actions
- Approval rates
- Average processing time

## Error Handling

### Connection Issues
- Automatic reconnection with exponential backoff
- Graceful degradation when queue is unavailable
- Detailed error logging

### Message Processing
- Invalid messages are logged and discarded
- Processing errors trigger message requeue
- Duplicate detection prevents data corruption

## Deployment Considerations

1. **Environment Variables**: Ensure all AMQP configuration is set
2. **Database Migration**: Run `npx prisma db push` to create the new table
3. **Queue Access**: Verify network access to the AMQP broker
4. **Monitoring**: Set up alerts for queue health and processing errors

## Migration from Dummy Data

The system automatically migrates from dummy data to real queue data:
- Existing dummy data functions are replaced with database queries
- UI components continue to work without changes
- Metrics are calculated from real data
- Status updates are persisted to the database
