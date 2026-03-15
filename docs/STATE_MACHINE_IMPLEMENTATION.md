# State Machine Implementation for Lead Management

## Overview

This document describes the implementation of a state machine-based lead management system using XState. The state machine provides a robust, configurable, and auditable way to manage lead progression through different pipeline stages.

## Architecture

### Core Components

1. **State Machine Service** (`lib/state-machine-service.ts`)
   - Generates state machines dynamically from tenant configuration
   - Manages state transitions and validation
   - Handles SLA timers and notifications

2. **Tenant Service** (`lib/tenant-service.ts`)
   - Multi-tenant support with subdomain-based routing
   - Tenant-specific configurations and state machines

3. **Database Schema** (Prisma)
   - Pipeline stages, validation rules, SLA configurations
   - State transition history and audit trails

4. **React Components** (`components/state-machine/`)
   - Visual state machine representation
   - Interactive transition controls

## Key Features

### 1. Dynamic State Machine Generation

State machines are generated dynamically from database configuration:

```typescript
// Example: Generate state machine for a tenant
const machine = await stateMachineService.getStateMachine(tenantId);

// Execute a transition
const result = await stateMachineService.executeTransition(
  leadId,
  'TRANSITION_TO_QUALIFICATION',
  { reason: 'Lead qualified' },
  userId
);
```

### 2. Configurable Pipeline Stages

Each tenant can define their own pipeline stages:

```sql
-- Example pipeline stages
INSERT INTO PipelineStage (name, order, color, allowedTransitions) VALUES
('New Lead', 1, '#3b82f6', ['qualification', 'closed_lost']),
('Qualification', 2, '#8b5cf6', ['proposal', 'closed_lost']),
('Proposal', 3, '#ec4899', ['negotiation', 'closed_lost']),
('Negotiation', 4, '#f59e0b', ['closed_won', 'closed_lost']),
('Closed Won', 5, '#10b981', []),
('Closed Lost', 6, '#ef4444', []);
```

### 3. Validation Rules

Configurable validation rules that can block or warn on transitions:

```json
{
  "name": "Required Fields Check",
  "conditions": {
    "type": "required_fields",
    "fields": ["firstname", "lastname", "emailAddress"]
  },
  "actions": {
    "onFailure": "block_transition",
    "message": "Please fill in all required fields"
  },
  "severity": "error"
}
```

### 4. SLA Management

Automatic SLA tracking with escalation rules:

```json
{
  "name": "New Lead Response Time",
  "timeframe": 24,
  "timeUnit": "hours",
  "escalationRules": {
    "levels": [
      {
        "after": 12,
        "unit": "hours",
        "action": "notify_manager"
      }
    ]
  }
}
```

### 5. Audit Trail

Complete audit trail of all state transitions:

```typescript
// Every transition is logged
interface StateTransition {
  leadId: string;
  fromStageId: string;
  toStageId: string;
  event: string;
  triggeredBy: string;
  timestamp: Date;
  context: any;
  metadata: any;
}
```

## Implementation Details

### State Machine Structure

Each state machine follows this structure:

```typescript
const machine = createMachine({
  id: `lead-workflow-${tenantId}`,
  initial: 'new_lead',
  context: {
    leadId: '',
    tenantId: '',
    leadData: {},
    validationErrors: [],
    slaTimers: {}
  },
  states: {
    new_lead: {
      entry: ['startSLATimer', 'notifyStageEntry'],
      exit: ['clearSLATimer', 'notifyStageExit'],
      on: {
        TRANSITION_TO_QUALIFICATION: {
          target: 'qualification',
          cond: 'canTransitionToQualification',
          actions: ['validateTransition', 'recordStateTransition']
        }
      }
    }
    // ... other states
  }
});
```

### Multi-Tenant Support

The system supports multiple tenants with isolated configurations:

1. **Subdomain Routing**: `tenant1.example.com`, `tenant2.example.com`
2. **Tenant Middleware**: Extracts tenant from subdomain
3. **Isolated State Machines**: Each tenant has their own state machine configuration

### Database Schema

Key tables for state machine functionality:

```sql
-- Tenant configuration
CREATE TABLE Tenant (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  settings JSON
);

-- Pipeline stages per tenant
CREATE TABLE PipelineStage (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  order INTEGER NOT NULL,
  color TEXT NOT NULL,
  allowedTransitions TEXT[] NOT NULL,
  isInitialState BOOLEAN DEFAULT false,
  isFinalState BOOLEAN DEFAULT false
);

-- Validation rules
CREATE TABLE ValidationRule (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  name TEXT NOT NULL,
  conditions JSON NOT NULL,
  actions JSON NOT NULL,
  severity TEXT NOT NULL
);

-- SLA configurations
CREATE TABLE SLAConfig (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  pipelineStageId TEXT NOT NULL,
  timeframe INTEGER NOT NULL,
  timeUnit TEXT NOT NULL,
  escalationRules JSON NOT NULL
);

-- State transition history
CREATE TABLE StateTransition (
  id TEXT PRIMARY KEY,
  leadId TEXT NOT NULL,
  tenantId TEXT NOT NULL,
  fromStageId TEXT,
  toStageId TEXT NOT NULL,
  event TEXT NOT NULL,
  triggeredBy TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  context JSON,
  metadata JSON
);
```

## Usage Examples

### 1. Basic State Transition

```typescript
// Move a lead to the next stage
const result = await stateMachineService.executeTransition(
  'lead-123',
  'TRANSITION_TO_PROPOSAL',
  { 
    notes: 'Client interested in premium package',
    estimatedValue: 50000 
  },
  'user-456'
);

if (result.success) {
  console.log(`Lead moved to: ${result.newState}`);
} else {
  console.error('Transition failed:', result.errors);
}
```

### 2. Check Available Transitions

```typescript
// Get available transitions for a lead
const transitions = await stateMachineService.getAvailableTransitions('lead-123');
console.log('Available transitions:', transitions);
```

### 3. React Component Usage

```tsx
import { PipelineStateMachine } from '@/components/state-machine/pipeline-state-machine';

function LeadDetails({ lead, stages }) {
  const handleTransition = async (leadId: string, targetStageId: string) => {
    const response = await fetch(`/api/leads/${leadId}/transitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: `TRANSITION_TO_${targetStageId}`,
        userId: currentUser.id
      })
    });
    
    if (response.ok) {
      // Refresh lead data
      router.refresh();
    }
  };

  return (
    <PipelineStateMachine
      lead={lead}
      stages={stages}
      onTransition={handleTransition}
    />
  );
}
```

## API Endpoints

### Get Available Transitions
```
GET /api/leads/{id}/transitions
```

### Execute Transition
```
POST /api/leads/{id}/transitions
{
  "event": "TRANSITION_TO_QUALIFICATION",
  "data": { "reason": "Lead qualified" },
  "userId": "user-123"
}
```

### Tenant Management
```
GET /api/tenants
POST /api/tenants
```

## Benefits

### 1. **Consistency**
- Enforces business rules across all lead transitions
- Prevents invalid state changes
- Maintains data integrity

### 2. **Auditability**
- Complete history of all state changes
- Who made the change and when
- Context and metadata for each transition

### 3. **Flexibility**
- Configurable per tenant
- Easy to modify pipeline stages
- Extensible validation rules

### 4. **Reliability**
- Atomic state transitions
- Error handling and rollback
- SLA monitoring and alerts

### 5. **Scalability**
- Multi-tenant architecture
- Cached state machines
- Efficient database queries

## Configuration

### Setting Up a New Tenant

1. **Create Tenant**:
```typescript
const tenant = await createTenant({
  name: 'Acme Corp',
  slug: 'acme',
  domain: 'acme.example.com'
});
```

2. **Configure Pipeline Stages**:
```typescript
await prisma.pipelineStage.createMany({
  data: [
    {
      tenantId: tenant.id,
      name: 'Lead',
      order: 1,
      color: '#3b82f6',
      isInitialState: true,
      allowedTransitions: ['qualification']
    }
    // ... more stages
  ]
});
```

3. **Set Up Validation Rules**:
```typescript
await prisma.validationRule.create({
  data: {
    tenantId: tenant.id,
    name: 'Email Required',
    conditions: { type: 'required', field: 'email' },
    actions: { onFailure: 'block_transition' },
    severity: 'error'
  }
});
```

### Seeding Default Configuration

Run the seed script to set up a default tenant:

```bash
npx tsx lib/seed-tenant.ts
```

## Monitoring and Debugging

### State Machine Visualization

The React component provides visual representation of:
- Current state
- Available transitions
- Pipeline flow
- SLA status

### Logging

All state machine operations are logged:
- State transitions
- Validation failures
- SLA breaches
- Error conditions

### Metrics

Track important metrics:
- Transition success rates
- Average time in each stage
- SLA compliance
- Validation failure rates

## Future Enhancements

1. **Parallel States**: Support for parallel workflows
2. **Conditional Transitions**: More complex transition logic
3. **Workflow Templates**: Pre-built pipeline templates
4. **Integration Hooks**: Webhook support for external systems
5. **Advanced Analytics**: Pipeline performance insights
6. **Mobile Support**: Mobile-optimized state machine interface

## Conclusion

The state machine implementation provides a robust foundation for lead management with the flexibility to adapt to different business requirements while maintaining consistency and auditability. The multi-tenant architecture ensures scalability, and the visual components make it easy for users to understand and interact with the system.
