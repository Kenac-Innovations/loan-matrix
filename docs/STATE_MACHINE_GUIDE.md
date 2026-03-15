# Lead State Machine Implementation Guide

## Overview

This document describes the comprehensive state machine implementation for lead management in the Loan Matrix application. The system supports both automatic transitions based on Credit Decision Engine (CDE) results and manual transitions requiring human review.

## Architecture

### Components

1. **Lead State Manager** (`lib/lead-state-manager.ts`)
   - Core service handling state transitions
   - Manages both automatic and manual transitions
   - Validates transition rules and conditions

2. **State Machine Service** (`lib/state-machine-service.ts`)
   - XState-based state machine generator
   - Manages state definitions and transitions
   - Handles SLA timers and validation rules

3. **CDE Integration** (`lib/cde-utils.ts`)
   - Triggers automatic transitions after CDE evaluation
   - Builds CDE payloads from lead data
   - Stores CDE results in lead metadata

4. **API Routes**
   - `/api/leads/[id]/transition` - Manual state transitions
   - `/api/leads/[id]/history` - Transition history
   - `/api/cde/evaluate` - CDE evaluation proxy

5. **UI Components**
   - `StateTransitionManager` - Manual transition dialog
   - `TransitionHistory` - Timeline of state changes
   - `LeadActions` - Action buttons for lead management

## Pipeline Stages

The default pipeline stages are:

1. **New Lead** (Initial State)
   - Entry point for all new leads
   - Can transition to: Approved, Rejected

2. **Approved**
   - Lead has been approved for processing
   - Can transition to: Pending Disbursement, Rejected

3. **Rejected** (Final State)
   - Lead has been declined
   - No further transitions allowed

4. **Pending Disbursement**
   - Waiting for loan disbursement
   - Can transition to: Disbursed, Rejected

5. **Disbursed** (Final State)
   - Loan has been disbursed
   - No further transitions allowed

## Automatic Transitions

### CDE-Based Auto-Transitions

Automatic transitions are triggered after CDE evaluation based on the decision result:

#### Approved Applications
```typescript
CDE Decision: "APPROVED"
→ Auto-transition to: "Approved" stage

Conditions:
- No fraud detected (fraudCheck.fraudulent = false)
- All business rules pass
```

#### Declined Applications
```typescript
CDE Decision: "DECLINED"
→ Auto-transition to: "Rejected" stage

Conditions:
- None required (always auto-reject)
```

#### Manual Review Required
```typescript
CDE Decision: "MANUAL_REVIEW"
→ No automatic transition
→ Stays in current stage

Action Required:
- Human review of application
- Manual transition by authorized user
```

### Auto-Transition Rules

Rules are defined in `LeadStateManager.autoTransitionRules`:

```typescript
{
  cdeDecision: "APPROVED",
  targetStageName: "Approved",
  conditions: {
    fraudCheckPass: true,
    // Optional: minCreditScore, maxDTI, maxAPR
  }
}
```

### Customizing Auto-Transition Rules

You can add custom conditions to auto-transition rules:

```typescript
{
  cdeDecision: "APPROVED",
  targetStageName: "Approved",
  conditions: {
    minCreditScore: 650,      // Minimum credit score
    maxDTI: 0.43,             // Maximum DTI ratio (43%)
    maxAPR: 36.0,             // Maximum APR percentage
    fraudCheckPass: true,     // Must pass fraud check
  }
}
```

## Manual Transitions

### When Manual Transitions Are Needed

1. **CDE Manual Review**
   - CDE decision is "MANUAL_REVIEW"
   - Application requires human judgment
   - Edge cases or exceptions

2. **Overrides**
   - Business exceptions
   - Special approvals
   - Policy overrides

3. **Process Management**
   - Moving between stages
   - Handling special cases
   - Correcting errors

### Making Manual Transitions

#### Via UI
1. Open lead details page
2. Click "Change Stage" button
3. Select target stage
4. Optionally provide reason
5. Confirm transition

#### Via API
```typescript
POST /api/leads/[id]/transition
{
  "targetStageName": "Approved",
  "reason": "Manual approval after review",
  "metadata": {
    // Additional data
  }
}
```

## State Transition Logging

All state transitions are logged in the `StateTransition` table:

```typescript
{
  leadId: string;
  tenantId: string;
  fromStageId: string | null;
  toStageId: string;
  event: string;
  triggeredBy: string;  // User ID or "system"
  triggeredAt: DateTime;
  metadata: {
    cdeDecision?: string;
    creditScore?: number;
    recommendation?: string;
    reason?: string;
    autoTransition?: boolean;
  }
}
```

### Event Types

- `CDE_AUTO_TRANSITION_APPROVED` - Automatic approval
- `CDE_AUTO_TRANSITION_DECLINED` - Automatic rejection
- `MANUAL_TRANSITION` - Manual state change
- `SLA_BREACH` - SLA timer expired
- `VALIDATION_FAILED` - Validation rule failed

## CDE Integration Flow

### 1. Lead Creation
```
New Lead Created
→ Initial stage: "New Lead"
→ CDE evaluation triggered (optional)
```

### 2. Loan Creation (After Contracts Uploaded)
```
Loan Created in Fineract
→ CDE evaluation triggered
→ CDE result stored in stateMetadata
→ Auto-transition check:
   - If APPROVED → Move to "Approved"
   - If DECLINED → Move to "Rejected"
   - If MANUAL_REVIEW → Stay in current stage
```

### 3. Affordability Data Save
```
Affordability Data Saved
→ CDE evaluation triggered
→ CDE result stored
→ Auto-transition check
```

### 4. Manual CDE Trigger
```
User clicks "Run CDE Evaluation"
→ CDE evaluation triggered
→ CDE result stored
→ Auto-transition check
```

## Viewing Transition History

### UI
Navigate to Lead Details → History Tab

Shows:
- All state transitions
- From/To stages
- Event type (Auto/Manual)
- Triggered by (User/System)
- Timestamp
- Metadata (CDE decision, credit score, reason, etc.)

### API
```typescript
GET /api/leads/[id]/history

Response:
{
  "history": [
    {
      "id": "string",
      "fromStage": "New Lead",
      "toStage": "Approved",
      "event": "CDE_AUTO_TRANSITION_APPROVED",
      "triggeredBy": "system",
      "triggeredAt": "2025-11-11T10:30:00Z",
      "metadata": {
        "cdeDecision": "APPROVED",
        "creditScore": 729,
        "autoTransition": true
      }
    }
  ]
}
```

## Customization

### Adding New Stages

1. Update `createDefaultPipelineStages` in `lib/tenant-service.ts`
2. Define stage properties:
   ```typescript
   {
     name: "Custom Stage",
     description: "Description",
     order: 3,
     color: "#3b82f6",
     isInitialState: false,
     isFinalState: false,
     allowedTransitions: [] // Will be updated later
   }
   ```
3. Update transitions map
4. Run database migration/seed

### Adding Custom Auto-Transition Rules

Edit `LeadStateManager.autoTransitionRules`:

```typescript
private autoTransitionRules: AutoTransitionRule[] = [
  // Existing rules...
  {
    cdeDecision: "APPROVED",
    targetStageName: "Custom Stage",
    conditions: {
      minCreditScore: 700,
      maxDTI: 0.35,
      fraudCheckPass: true,
    },
  },
];
```

### Adding Validation Rules

Validation rules can be attached to stages to enforce business logic:

```typescript
await prisma.validationRule.create({
  data: {
    tenantId: "tenant-id",
    pipelineStageId: "stage-id",
    name: "Minimum Income Requirement",
    description: "Verify minimum monthly income",
    conditions: {
      field: "monthlyIncome",
      operator: ">=",
      value: 5000,
    },
    actions: {
      onFailure: "BLOCK_TRANSITION",
      message: "Monthly income must be at least $5,000",
    },
    severity: "error",
    enabled: true,
  },
});
```

## Best Practices

### 1. Auto-Transition Conditions
- Keep conditions simple and clear
- Document business rules
- Test edge cases thoroughly
- Log all conditions checked

### 2. Manual Transitions
- Require reason for manual transitions
- Log who made the transition
- Include relevant metadata
- Audit manual overrides

### 3. CDE Integration
- Always store CDE results
- Trigger CDE at appropriate points
- Handle CDE failures gracefully
- Don't block on CDE errors

### 4. State Transition History
- Log all transitions
- Include sufficient metadata
- Make history searchable
- Use for audit trails

### 5. User Experience
- Show clear state information
- Indicate when manual review needed
- Display transition history
- Provide transition reasons

## Monitoring and Debugging

### Logging
All state transitions are logged with:
- Lead ID
- Stage names (from/to)
- Event type
- User/System trigger
- CDE decision (if applicable)
- Credit score (if applicable)

### Console Logs
Look for:
- `=== PROCESSING CDE RESULT FOR STATE TRANSITION ===`
- `=== CHECKING FOR AUTOMATIC STATE TRANSITION ===`
- `=== MANUAL STATE TRANSITION ===`
- `✅ Lead automatically transitioned to: [Stage]`
- `⚠️  Manual review required - no automatic transition`

### Database Queries
```sql
-- View recent transitions
SELECT * FROM "StateTransition"
ORDER BY "triggeredAt" DESC
LIMIT 50;

-- Count transitions by event type
SELECT event, COUNT(*)
FROM "StateTransition"
GROUP BY event;

-- Find leads requiring manual review
SELECT l.id, l.firstname, l.lastname, 
       l."stateMetadata"->>'cdeResult'->'decision' as cde_decision
FROM "Lead" l
WHERE l."stateMetadata"->>'cdeResult'->'decision' = '"MANUAL_REVIEW"';
```

## Troubleshooting

### Auto-Transition Not Working

1. **Check CDE Result**
   ```typescript
   // Lead stateMetadata should contain cdeResult
   const cdeResult = lead.stateMetadata.cdeResult;
   console.log("CDE Decision:", cdeResult?.decision);
   ```

2. **Check Conditions**
   - Verify fraud check passed
   - Check credit score threshold
   - Verify DTI ratio
   - Check APR limits

3. **Check Allowed Transitions**
   ```typescript
   // Current stage must allow transition to target stage
   const allowed = currentStage.allowedTransitions;
   console.log("Allowed transitions:", allowed);
   ```

### Manual Transition Fails

1. **Check Allowed Transitions**
   - Target stage must be in allowedTransitions array
   
2. **Check Stage Exists**
   - Verify target stage name is correct
   - Check stage is active

3. **Check Permissions**
   - User must be authenticated
   - User must have permission to transition

### CDE Not Triggering

1. **Check CDE Service**
   - Verify CDE_BASE_URL is correct
   - Check tenant ID is set
   - Verify network connectivity

2. **Check Payload**
   - Ensure all required fields present
   - Verify Fineract loan ID
   - Check data types

## Future Enhancements

1. **Role-Based Transitions**
   - Restrict certain transitions to specific roles
   - Implement approval workflows

2. **Parallel Workflows**
   - Support multiple workflow paths
   - Conditional branching

3. **SLA Monitoring**
   - Track time in each stage
   - Alert on SLA breaches
   - Auto-escalate overdue leads

4. **Advanced Conditions**
   - Complex business rules
   - Multi-factor conditions
   - External service checks

5. **Workflow Templates**
   - Pre-defined workflow patterns
   - Industry-specific templates
   - Configurable from UI

## Support

For questions or issues:
1. Check console logs
2. Review StateTransition table
3. Verify CDE results in lead stateMetadata
4. Check pipeline stage configuration


