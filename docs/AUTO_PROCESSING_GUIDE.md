# Auto-Processing Guide

## Overview

Not all leads are automatically processed. The system uses specific criteria to determine which leads qualify for automatic state transitions based on CDE results. This ensures that high-risk or complex applications receive human review while straightforward cases are processed efficiently.

## Auto-Processing Criteria

For a lead to qualify for automatic processing, it must meet ALL of the following criteria:

### 1. Loan Amount Threshold
- **Requirement**: Loan amount must be **under $50,000**
- **Reason**: Larger loans require additional scrutiny and risk assessment
- **Example**: 
  - ✅ $45,000 loan - Qualifies
  - ❌ $55,000 loan - Requires manual review

### 2. Credit Score Threshold
- **Requirement**: Credit score must be **650 or higher**
- **Reason**: Ensures borrower has demonstrated creditworthiness
- **Example**:
  - ✅ Credit score 729 - Qualifies
  - ❌ Credit score 620 - Requires manual review

### 3. Debt-to-Income (DTI) Ratio
- **Requirement**: DTI must be **under 43%**
- **Reason**: Ensures borrower can afford the loan payments
- **Example**:
  - ✅ DTI 35% - Qualifies
  - ❌ DTI 48% - Requires manual review

### 4. Annual Percentage Rate (APR)
- **Requirement**: APR must be **under 36%**
- **Reason**: Protects borrowers from predatory lending rates
- **Example**:
  - ✅ APR 24% - Qualifies
  - ❌ APR 42% - Requires manual review

### 5. Fraud Check
- **Requirement**: No fraud indicators detected
- **Reason**: Any fraud risk requires human investigation
- **Example**:
  - ✅ Fraud check: NONE - Qualifies
  - ❌ Fraud check: HIGH - Requires manual review

## How It Works

### Automatic Approval Flow

```
1. Lead created/CDE evaluation triggered
2. CDE returns: "APPROVED"
3. System checks auto-processing criteria:
   ✓ Loan amount: $45,000 (under $50k)
   ✓ Credit score: 729 (above 650)
   ✓ DTI: 32% (under 43%)
   ✓ APR: 24% (under 36%)
   ✓ Fraud: NONE
4. ✅ All criteria met
5. Auto-transition to "Approved" stage
6. Log: "CDE_AUTO_TRANSITION_APPROVED"
```

### Manual Review Required Flow

```
1. Lead created/CDE evaluation triggered
2. CDE returns: "APPROVED"
3. System checks auto-processing criteria:
   ✓ Loan amount: $65,000 (OVER $50k)
   ✗ DISQUALIFIED
4. ⚠️ Criteria not met
5. Lead stays in current stage
6. Flag: "requiresManualReview": true
7. Store reason: "Loan amount ($65,000) exceeds threshold"
8. Notify: Manual review required
```

### Automatic Rejection Flow

```
1. CDE returns: "DECLINED"
2. System checks decline reason:
   - Fraud detected? → Auto-reject
   - Affordability failed? → Auto-reject
   - Other reason? → Manual review
3. If auto-reject criteria met:
   ✅ Auto-transition to "Rejected" stage
4. Log: "CDE_AUTO_TRANSITION_DECLINED"
```

## Configuring Auto-Processing Thresholds

Thresholds are defined in `lib/lead-state-manager.ts`:

```typescript
const AUTO_PROCESS_THRESHOLDS = {
  maxLoanAmount: 50000,   // $50k
  minCreditScore: 650,    // 650
  maxDTI: 0.43,          // 43%
  maxAPR: 36.0,          // 36%
};
```

### Customizing Thresholds

To change the thresholds for your organization:

1. **Edit the configuration**:
```typescript
const AUTO_PROCESS_THRESHOLDS = {
  maxLoanAmount: 100000,  // Increase to $100k
  minCreditScore: 700,    // Increase to 700
  maxDTI: 0.40,          // Decrease to 40%
  maxAPR: 30.0,          // Decrease to 30%
};
```

2. **Consider your risk appetite**:
   - Higher thresholds = More auto-processing, higher risk
   - Lower thresholds = More manual review, lower risk

3. **Monitor results**:
   - Track auto vs manual review rates
   - Measure default rates by processing type
   - Adjust thresholds based on performance

## Manual Control

### Disabling Auto-Processing for a Lead

Users can manually disable auto-processing for specific leads:

1. Open lead details page
2. In the sidebar, find "Auto-Processing" card
3. Toggle switch to **OFF**
4. Provide reason (recommended)
5. Click "Confirm"

**Use Cases**:
- VIP customer requiring special handling
- Complex application needing review
- Policy exception
- Regulatory requirement

### Enabling Auto-Processing

Re-enable auto-processing:

1. Toggle switch to **ON**
2. Provide reason
3. Click "Confirm"
4. System clears previous disqualification
5. Next CDE evaluation can auto-process (if criteria met)

### API Control

Programmatically control auto-processing:

```typescript
// Disable auto-processing
POST /api/leads/[id]/auto-process
{
  "enabled": false,
  "reason": "VIP customer - requires manual review"
}

// Enable auto-processing
POST /api/leads/[id]/auto-process
{
  "enabled": true,
  "reason": "Standard processing restored"
}

// Get status
GET /api/leads/[id]/auto-process
Response:
{
  "autoProcessingEnabled": true,
  "disqualified": false,
  "reason": null,
  "requiresManualReview": false
}
```

## Viewing Auto-Processing Status

### In the UI

The "Auto-Processing" card in the lead sidebar shows:

1. **Status Badge**
   - Green "Enabled" - Auto-processing active
   - Amber "Disabled" - Manual-only mode

2. **Disqualification Notice**
   - Shows if lead was disqualified
   - Displays specific reason
   - E.g., "Loan amount ($65,000) exceeds threshold ($50,000)"

3. **Manual Review Flag**
   - Indicates if manual review required
   - Shows even if auto-processing enabled

4. **Criteria List**
   - Shows all auto-processing criteria
   - Helps users understand requirements

### In Logs

Console logs show auto-processing decisions:

```
=== CHECKING FOR AUTOMATIC STATE TRANSITION ===
Lead qualifies for auto-processing: Meets all auto-process criteria
✅ Lead automatically transitioned to: Approved
```

Or:

```
Lead does not qualify for auto-processing: 
Loan amount ($65,000) exceeds auto-process threshold ($50,000)
⚠️ Manual review required
```

### In Database

Check `stateMetadata` field:

```json
{
  "cdeResult": { ... },
  "autoProcessingDisqualified": true,
  "autoProcessingReason": "Loan amount ($65,000) exceeds threshold",
  "requiresManualReview": true,
  "disableAutoTransition": false
}
```

## Best Practices

### 1. Set Conservative Thresholds Initially
Start with strict criteria and loosen as you gain confidence:
- Lower loan amounts
- Higher credit scores
- Lower DTI and APR limits

### 2. Monitor Auto-Processing Rate
Track what percentage of leads auto-process:
- Too high (>80%): Consider tightening criteria
- Too low (<20%): Consider loosening criteria
- Sweet spot: 40-60%

### 3. Review Disqualified Leads
Regularly review why leads are disqualified:
- Common pattern: Adjust thresholds
- Edge cases: Document manual review process
- System errors: Fix bugs

### 4. Document Override Reasons
Always provide clear reasons when:
- Disabling auto-processing
- Re-enabling after disqualification
- Manual transitions despite CDE results

### 5. Audit Auto-Processed Leads
Periodically sample auto-processed leads:
- Verify decisions were appropriate
- Check for pattern of errors
- Adjust criteria if needed

## Risk Management

### Low-Risk Auto-Processing

Suitable for:
- ✅ Small loan amounts (under $25k)
- ✅ Excellent credit (750+)
- ✅ Low DTI (under 30%)
- ✅ Standard products
- ✅ Existing customers

### Require Manual Review

Always require manual review for:
- ❌ Large loans (over $100k)
- ❌ Poor credit (under 600)
- ❌ High DTI (over 50%)
- ❌ Complex products
- ❌ First-time borrowers
- ❌ Any fraud indicators
- ❌ Unusual circumstances

## Troubleshooting

### Lead Not Auto-Processing (Expected to)

1. **Check CDE decision**
   - Must be "APPROVED" or "DECLINED"
   - "MANUAL_REVIEW" never auto-processes

2. **Check thresholds**
   ```sql
   SELECT 
     "requestedAmount",
     "stateMetadata"->>'cdeResult'->'scoringResult'->>'creditScore' as credit_score,
     "stateMetadata"->>'cdeResult'->'affordabilityResult'->>'dtiRatio' as dti,
     "stateMetadata"->>'cdeResult'->'pricingResult'->>'calculatedAPR' as apr
   FROM "Lead"
   WHERE id = 'lead-id';
   ```

3. **Check manual disable**
   ```sql
   SELECT "stateMetadata"->>'disableAutoTransition' as disabled
   FROM "Lead"
   WHERE id = 'lead-id';
   ```

4. **Check logs**
   Look for "Lead does not qualify" message with reason

### Lead Auto-Processing (Not Expected to)

1. **Verify thresholds are correct**
2. **Check if criteria were loosened recently**
3. **Review StateTransition record for metadata**
4. **Consider tightening criteria**

### Disqualification Not Clearing

1. **Ensure auto-processing re-enabled**:
   ```javascript
   POST /api/leads/[id]/auto-process
   { "enabled": true }
   ```

2. **Trigger new CDE evaluation**:
   - Updates will re-check criteria
   - Previous disqualification cleared automatically

## Summary

Auto-processing provides:
- ✅ **Efficiency** - Fast processing for straightforward cases
- ✅ **Risk Management** - Human review for complex cases
- ✅ **Flexibility** - Configurable thresholds and manual overrides
- ✅ **Transparency** - Clear criteria and disqualification reasons
- ✅ **Control** - Per-lead enable/disable capability

The system balances automation with appropriate human oversight, ensuring both speed and safety in loan processing.


