# Client API Endpoints

This document describes the client-related API endpoints available in the Loan Matrix system.

## Fineract Client Endpoints

### 1. Get Client by External ID (National ID)

**Endpoint:** `GET /api/fineract/clients/external-id/{externalId}`

**Description:** Fetches client details using the external ID (national ID) to retrieve the email address and other client information.

**Parameters:**
- `externalId` (path parameter): The national ID or external identifier of the client

**Response Example:**
```json
{
  "id": 27,
  "accountNo": "000000027",
  "activationDate": "2025-08-13",
  "active": true,
  "displayName": "savings test",
  "emailAddress": "test@test.com",
  "externalId": "123",
  "firstname": "savings",
  "lastname": "test",
  "officeId": 1,
  "officeName": "Head Office",
  "savingsProductId": 4,
  "savingsProductName": "account overdraft",
  "status": {
    "code": "clientStatusType.active",
    "description": "Active",
    "id": 300
  },
  "timeline": {
    "activatedByFirstname": "App",
    "activatedByLastname": "Administrator",
    "activatedByUsername": "mifos",
    "activatedOnDate": "2025-08-13",
    "submittedByFirstname": "App",
    "submittedByLastname": "Administrator",
    "submittedByUsername": "mifos",
    "submittedOnDate": "2025-08-13"
  }
}
```

**Usage Example:**
```typescript
import { getClientByExternalId } from '@/lib/client-service';

// Fetch client details by national ID
const clientDetails = await getClientByExternalId('123');
console.log('Client email:', clientDetails.emailAddress);
```

### 2. Get Client by ID

**Endpoint:** `GET /api/fineract/clients/{id}`

**Description:** Fetches client details using the internal client ID.

**Parameters:**
- `id` (path parameter): The internal client ID

### 3. Search Clients

**Endpoint:** `GET /api/fineract/clients?search={query}&offset={offset}&limit={limit}`

**Description:** Searches for clients with optional filters and pagination.

**Query Parameters:**
- `search` (optional): Search query string
- `offset` (optional): Pagination offset (default: 0)
- `limit` (optional): Pagination limit (default: 20)

### 4. Create Client

**Endpoint:** `POST /api/fineract/clients`

**Description:** Creates a new client in the system.

**Body:** Client creation payload

### 5. Update Client

**Endpoint:** `PUT /api/fineract/clients/{id}`

**Description:** Updates an existing client.

**Parameters:**
- `id` (path parameter): The client ID to update

**Body:** Updated client data

### 6. Delete Client

**Endpoint:** `DELETE /api/fineract/clients/{id}`

**Description:** Deletes a client from the system.

**Parameters:**
- `id` (path parameter): The client ID to delete

## Client Service Functions

The system provides utility functions in `lib/client-service.ts` for common client operations:

```typescript
import { 
  getClientByExternalId,
  getClientById,
  searchClients,
  createClient,
  updateClient
} from '@/lib/client-service';

// Get client by external ID (national ID)
const client = await getClientByExternalId('123');

// Get client by internal ID
const client = await getClientById(27);

// Search clients
const results = await searchClients('john', 0, 10);

// Create new client
const newClient = await createClient(clientData);

// Update existing client
const updatedClient = await updateClient(27, updatedData);
```

## Testing

### Test Endpoint

**Endpoint:** `GET /api/test/client-external-id?externalId={externalId}`

**Description:** Test endpoint to verify the client by external ID functionality is working correctly.

**Usage:** Visit `/api/test/client-external-id?externalId=123` in your browser or make a GET request to test the functionality.

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- `200`: Success
- `400`: Bad Request (missing parameters)
- `404`: Client not found
- `500`: Internal server error

Error responses include:
```json
{
  "error": "Error message",
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

## Authentication

All endpoints require authentication via NextAuth.js. The access token is automatically included in requests to the Fineract API.

## Notes

- The external ID endpoint is particularly useful for retrieving client email addresses when you only have the national ID
- All endpoints follow the same pattern as other Fineract API endpoints in the system
- The client service functions provide a clean abstraction layer for client operations
- Error handling is consistent across all endpoints
