# Auto-Processing System - Implementation Summary

## What Changed

### Problem
Initially, ALL leads with CDE "APPROVED" or "DECLINED" decisions would automatically transition to the next stage. This was too aggressive and didn't account for:
- High-value loans requiring extra scrutiny
- Marginal credit profiles
- Risk tolerance thresholds
- Regulatory requirements

### Solution
Implemented granular auto-processing controls with:
1. **Configurable thresholds** for automatic processing
2. **Multi-criteria qualification** system
3. **Per-lead manual override** capability
4. **Transparent disqualification** reasons
5. **User-friendly UI controls**

## Auto-Processing Criteria

Only leads meeting **ALL** criteria qualify for automatic processing:

| Criterion | Threshold | Reason |
|-----------|-----------|--------|
| **Loan Amount** | < $50,000 | Larger loans need human review |
| **Credit Score** | ≥ 650 | Ensures proven creditworthiness |
| **DTI Ratio** | < 43% | Confirms ability to repay |
| **APR** | < 36% | Protects from predatory rates |
| **Fraud Check** | None detected | Any fraud risk needs investigation |

## Decision Flow

### Scenario 1: Qualifies for Auto-Processing

```
Lead: $45,000 loan, Credit Score: 729, DTI: 32%, APR: 24%, No Fraud

CDE Decision: APPROVED
↓
Check #1: CDE allows auto-transition? ✅ Yes (APPROVED)
↓
Check #2: Loan amount < $50k? ✅ Yes ($45k)
↓
Check #3: Credit score ≥ 650? ✅ Yes (729)
↓
Check #4: DTI < 43%? ✅ Yes (32%)
↓
Check #5: APR < 36%? ✅ Yes (24%)
↓
Check #6: No fraud? ✅ Yes (NONE)
↓
✅ AUTO-APPROVE → "Approved" stage
```

### Scenario 2: Disqualified from Auto-Processing

```
Lead: $65,000 loan, Credit Score: 720, DTI: 35%, APR: 28%, No Fraud

CDE Decision: APPROVED
↓
Check #1: CDE allows auto-transition? ✅ Yes (APPROVED)
↓
Check #2: Loan amount < $50k? ❌ No ($65k exceeds $50k)
↓
⚠️ DISQUALIFIED: "Loan amount ($65,000) exceeds threshold ($50,000)"
↓
Store reason in stateMetadata
↓
Set requiresManualReview flag
↓
Lead stays in current stage
↓
User notified: Manual review required
```

### Scenario 3: Manual Auto-Processing Disabled

```
Lead: $30,000 loan, Credit Score: 750, All criteria met

User action: Disabled auto-processing (VIP customer)
↓
stateMetadata.disableAutoTransition = true
↓
CDE Decision: APPROVED
↓
Check #1: Auto-processing disabled? ❌ Yes
↓
⚠️ Reason: "Auto-transition disabled for this lead"
↓
Lead stays in current stage
↓
Awaits manual transition
```

## Implementation Details

### Code Changes

#### 1. `lib/lead-state-manager.ts`

Added `canAutoProcessLead()` method:
```typescript
private async canAutoProcessLead(
  leadId: string,
  cdeResult: CDEResult
): Promise<{ canAuto: boolean; reason?: string }> {
  // Check if explicitly disabled
  if (stateMetadata.disableAutoTransition === true) {
    return { canAuto: false, reason: "Auto-transition disabled" };
  }

  // Check thresholds
  if (loan amount > $50,000) return { canAuto: false, reason: ... };
  if (credit score < 650) return { canAuto: false, reason: ... };
  if (DTI > 43%) return { canAuto: false, reason: ... };
  if (APR > 36%) return { canAuto: false, reason: ... };
  if (fraud detected) return { canAuto: false, reason: ... };

  return { canAuto: true, reason: "Meets all criteria" };
}
```

Updated `processCDEResult()`:
```typescript
// First check: CDE decision type
if (!shouldAutoTransition(cdeResult)) {
  return { requiresManualReview: true };
}

// Second check: Lead-specific qualification
const autoProcessCheck = await canAutoProcessLead(leadId, cdeResult);
if (!autoProcessCheck.canAuto) {
  // Store disqualification reason
  // Set requiresManualReview flag
  return { requiresManualReview: true, message: autoProcessCheck.reason };
}

// Proceed with auto-transition
```

#### 2. API: `/api/leads/[id]/auto-process`

**GET** - Get auto-processing status:
```json
{
  "autoProcessingEnabled": true,
  "disqualified": false,
  "reason": null,
  "requiresManualReview": false
}
```

**POST** - Toggle auto-processing:
```json
{
  "enabled": false,
  "reason": "VIP customer requires manual approval"
}
```

#### 3. UI: `AutoProcessControl` Component

Features:
- Toggle switch for enable/disable
- Status badge (Enabled/Disabled)
- Disqualification notice with specific reason
- Manual review required indicator
- List of auto-processing criteria
- Confirmation dialog with reason input
- Refresh button

#### 4. Integration: Lead Sidebar

Added `AutoProcessControl` component at the top of the sidebar:
```tsx
<div className="space-y-6">
  <AutoProcessControl leadId={leadId} />
  {/* Other sidebar cards */}
</div>
```

### Database Schema (No Changes Required)

Uses existing `stateMetadata` JSON field:
```json
{
  "cdeResult": { ... },
  "autoProcessingDisqualified": true,
  "autoProcessingReason": "Loan amount ($65,000) exceeds threshold",
  "requiresManualReview": true,
  "disableAutoTransition": false,
  "autoProcessingChangedBy": "user-id",
  "autoProcessingChangedAt": "2025-11-11T10:30:00Z",
  "autoProcessingChangeReason": "VIP customer"
}
```

## User Experience

### For Loan Officers

1. **Visual Indicator**
   - Sidebar shows auto-processing status
   - Clear "Enabled" or "Disabled" badge
   - Disqualification reasons displayed

2. **Manual Control**
   - Easy toggle switch
   - Reason input for changes
   - Immediate feedback

3. **Transparency**
   - See why lead didn't auto-process
   - Understand criteria required
   - Make informed decisions

### For Managers

1. **Risk Management**
   - Configure thresholds to match risk appetite
   - Override auto-processing when needed
   - Audit trail of all changes

2. **Compliance**
   - Ensure high-value loans get review
   - Document manual interventions
   - Meet regulatory requirements

3. **Efficiency**
   - Straightforward cases auto-process
   - Team focuses on complex applications
   - Faster turnaround times

## Configuration

### Adjusting Thresholds

Edit `lib/lead-state-manager.ts`:

```typescript
const AUTO_PROCESS_THRESHOLDS = {
  maxLoanAmount: 50000,   // Change to 100000 for $100k limit
  minCreditScore: 650,    // Change to 700 for stricter
  maxDTI: 0.43,          // Change to 0.40 for 40% limit
  maxAPR: 36.0,          // Change to 30.0 for 30% limit
};
```

### Per-Environment Configuration

Consider using environment variables:

```typescript
const AUTO_PROCESS_THRESHOLDS = {
  maxLoanAmount: parseInt(process.env.AUTO_PROCESS_MAX_LOAN || "50000"),
  minCreditScore: parseInt(process.env.AUTO_PROCESS_MIN_CREDIT || "650"),
  maxDTI: parseFloat(process.env.AUTO_PROCESS_MAX_DTI || "0.43"),
  maxAPR: parseFloat(process.env.AUTO_PROCESS_MAX_APR || "36.0"),
};
```

Then in `.env`:
```bash
# Production (stricter)
AUTO_PROCESS_MAX_LOAN=25000
AUTO_PROCESS_MIN_CREDIT=700
AUTO_PROCESS_MAX_DTI=0.35
AUTO_PROCESS_MAX_APR=30.0

# Development (looser for testing)
AUTO_PROCESS_MAX_LOAN=100000
AUTO_PROCESS_MIN_CREDIT=600
AUTO_PROCESS_MAX_DTI=0.50
AUTO_PROCESS_MAX_APR=40.0
```

## Monitoring & Analytics

### Key Metrics to Track

1. **Auto-Processing Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE "stateMetadata"->>'autoProcessingDisqualified' = 'false') * 100.0 / COUNT(*) as auto_rate
   FROM "StateTransition"
   WHERE event LIKE 'CDE_AUTO_%';
   ```

2. **Disqualification Reasons**
   ```sql
   SELECT 
     "stateMetadata"->>'autoProcessingReason' as reason,
     COUNT(*) as count
   FROM "Lead"
   WHERE "stateMetadata"->>'autoProcessingDisqualified' = 'true'
   GROUP BY reason
   ORDER BY count DESC;
   ```

3. **Manual Override Rate**
   ```sql
   SELECT COUNT(*) as manual_overrides
   FROM "Lead"
   WHERE "stateMetadata"->>'disableAutoTransition' = 'true';
   ```

### Success Indicators

- ✅ Auto-processing rate: 40-60%
- ✅ Disqualifications clearly tracked
- ✅ Manual overrides documented
- ✅ No auto-processed defaults
- ✅ Faster processing for qualified leads

## Benefits

### 1. Risk Mitigation
- ❌ Before: All "APPROVED" auto-processed
- ✅ After: Only low-risk leads auto-processed

### 2. Compliance
- ❌ Before: No control over large loan processing
- ✅ After: High-value loans require human review

### 3. Flexibility
- ❌ Before: All-or-nothing auto-processing
- ✅ After: Per-lead and per-criteria control

### 4. Transparency
- ❌ Before: Unknown why lead didn't auto-process
- ✅ After: Clear reasons displayed to users

### 5. Audit Trail
- ❌ Before: No record of manual overrides
- ✅ After: All changes logged with reasons

## Testing Checklist

- [ ] Create $45k loan with good credit → Should auto-approve
- [ ] Create $65k loan with good credit → Should require manual review
- [ ] Create $30k loan with 620 credit score → Should require manual review
- [ ] Create $40k loan with 50% DTI → Should require manual review
- [ ] Create $35k loan with 40% APR → Should require manual review
- [ ] Disable auto-processing for a lead → Should not auto-process
- [ ] Re-enable auto-processing → Should clear disqualification
- [ ] Check StateTransition metadata → Should include disqualification reasons
- [ ] View sidebar → Should show auto-processing status
- [ ] Toggle auto-processing → Should update and log change

## Summary

The enhanced auto-processing system provides:

✅ **Granular Control** - Multi-criteria qualification system
✅ **Risk Management** - Configurable thresholds match your risk appetite
✅ **Transparency** - Clear reasons for disqualification
✅ **Flexibility** - Per-lead manual overrides
✅ **User-Friendly** - Simple toggle in UI
✅ **Audit Trail** - Complete logging of all decisions
✅ **Compliance** - Ensures appropriate human review

The system now intelligently determines which leads should be auto-processed, ensuring that straightforward applications move quickly while complex or high-risk cases receive appropriate human review.


