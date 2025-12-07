# End-of-Day Reconciliation Plan

## Overview
At the end of the day, after closing session and settling, the cashier must return all cash to the teller vault. The cashier's balance should become 0, and all money should be back in the vault.

## Current Flow
1. **Allocate Cash to Cashier**: Branch manager allocates cash from teller vault to cashier
2. **Start Session**: Cashier starts session with allocated balance
3. **Perform Transactions**: Cashier handles deposits, withdrawals, loan repayments
4. **Close Session**: Cashier hands in counted cash, variance is calculated and recorded
5. **Settle**: Branch manager recognizes variance (status: PENDING)

## Proposed End-of-Day Flow

### Step 1: Close Session (Already Implemented)
- Cashier enters counted cash amount
- System calculates: `variance = countedCash - expectedBalance`
- Variance is recorded as allocation adjustment:
  - Shortage (negative): reduces cashier balance (they owe it)
  - Surplus (positive): increases cashier balance (owed to them)
- Session status: `CLOSED`

### Step 2: Settle (Already Implemented)
- Branch manager reviews closed session
- Creates settlement record with status: `PENDING`
- Variance is recognized but remains in cashier's balance

### Step 3: Return Cash to Vault (NEW - To Implement)
**Action**: "Return Cash" or "Reconcile" button on settlement page

**Process**:
1. Calculate cash to return:
   ```
   cashToReturn = closingBalance (from session)
   ```
   - This is the actual counted cash the cashier hands in
   - Includes any variance (shortage or surplus)

2. Reverse all cashier allocations:
   - Mark all ACTIVE allocations for this cashier as `REVERSED`
   - This removes them from cashier's balance calculation
   - Keep records for audit trail

3. Create teller vault allocation:
   - Create new `CashAllocation` with:
     - `cashierId: null` (teller vault allocation)
     - `amount: cashToReturn`
     - `notes: "Returned from cashier [name] - Session [date] - Settlement [id]"`
     - `status: "ACTIVE"`

4. Handle variance:
   - If shortage (negative variance):
     - Cashier owes the difference
     - Create a negative allocation adjustment for the shortage
     - OR create a separate "Outstanding Balance" record
   - If surplus (positive variance):
     - Cashier is owed the difference
     - Create a positive allocation adjustment
     - OR create a separate "Payable" record

5. Update settlement status:
   - Change settlement status from `PENDING` to `RECONCILED`
   - Add reconciliation date and notes

6. Verify cashier balance is 0:
   - After reversing allocations and returning cash
   - Cashier's active allocations should sum to 0
   - Any variance should be tracked separately

## Implementation Details

### New API Endpoint
**POST** `/api/tellers/[id]/cashiers/[cashierId]/reconcile`

**Request Body**:
```json
{
  "settlementId": "string",
  "returnedAmount": number,
  "notes": "string"
}
```

**Process**:
1. Validate settlement exists and is PENDING
2. Get all ACTIVE allocations for cashier
3. Calculate total allocated = sum of allocations
4. Calculate variance = returnedAmount - (allocated + cashIn - cashOut)
5. Reverse all cashier allocations (status: REVERSED)
6. Create teller vault allocation (amount: returnedAmount)
7. If variance exists, create variance record
8. Update settlement status to RECONCILED
9. Return reconciliation summary

### Database Changes

#### Update CashSettlement Model
Add fields to track reconciliation:
```prisma
model CashSettlement {
  // ... existing fields
  reconciledAt        DateTime?
  reconciledBy        String?
  reconciliationNotes String?
  returnedAmount      Float?    // Actual amount returned to vault
  // ... rest of fields
}
```

#### Update CashAllocation Status
Already supports `REVERSED` status - use it to mark allocations as returned.

### UI Changes

#### Settlement Page
Add "Reconcile" button that:
- Shows summary:
  - Allocated to cashier: $X
  - Cash in: $Y
  - Cash out: $Z
  - Expected balance: $W
  - Counted cash: $V
  - Variance: $D
  - Amount to return: $V
- Input field for actual returned amount (pre-filled with counted cash)
- Notes field
- Confirmation dialog
- After reconciliation, show:
  - Cashier balance: $0
  - Vault balance increased by returned amount
  - Variance status

#### Cashier Balance Display
- Show active allocations only (exclude REVERSED)
- Show outstanding variance separately if exists
- After reconciliation, balance should be 0

#### Teller Vault Display
- Show all vault allocations (cashierId: null)
- Include returned cash allocations
- Show available balance = vault - allocated to cashiers

## Example Scenario

### Initial State
- Teller vault: $10,000
- Allocated to Cashier A: $2,000
- Available balance: $8,000

### During Day
- Cashier A receives: $500 (deposits)
- Cashier A pays out: $300 (withdrawals)
- Expected balance: $2,000 + $500 - $300 = $2,200

### Close Session
- Counted cash: $2,150
- Variance: $2,150 - $2,200 = -$50 (shortage)
- Cashier balance: $2,000 - $50 = $1,950 (variance adjustment)

### Settle
- Settlement created with variance: -$50
- Status: PENDING

### Reconcile (Return Cash)
1. Reverse cashier allocation: $2,000 → status REVERSED
2. Create vault allocation: $2,150 (returned cash)
3. Create variance record: -$50 (cashier owes)
4. Update settlement: status RECONCILED

### Final State
- Cashier balance: $0 (all allocations reversed)
- Cashier owes: $50 (variance - tracked separately)
- Teller vault: $10,000 + $2,150 = $12,150
- Available balance: $12,150 (no active cashier allocations)

## Variance Handling Options

### Option 1: Variance as Outstanding Balance
- Create separate "OutstandingBalance" model
- Track what cashier owes or is owed
- Can be settled separately later

### Option 2: Variance as Allocation Adjustment
- Keep variance as allocation (can be negative)
- Shows in cashier balance as negative
- Can be cleared when cashier pays/collects

### Option 3: Variance as Settlement Record Only
- Variance only in settlement record
- Cashier balance becomes 0 after reconciliation
- Variance tracked for reporting but not in balance

**Recommendation**: Option 2 - Keep variance as allocation adjustment so it's visible in cashier balance and can be tracked until resolved.

## Edge Cases

1. **Multiple Sessions Same Day**: Reconcile all sessions together
2. **Partial Return**: Allow partial returns with notes
3. **Variance Resolution**: Allow marking variance as resolved (cashier paid/collected)
4. **Audit Trail**: Keep all records (REVERSED allocations, variance records) for audit

## Testing Checklist

- [ ] Cashier with no variance returns exact expected amount
- [ ] Cashier with shortage returns less, variance tracked
- [ ] Cashier with surplus returns more, variance tracked
- [ ] Multiple allocations reversed correctly
- [ ] Vault balance increases by returned amount
- [ ] Cashier balance becomes 0 after reconciliation
- [ ] Settlement status updates to RECONCILED
- [ ] Audit trail maintained (REVERSED allocations visible)
- [ ] Cannot reconcile twice
- [ ] Cannot reconcile before settlement


