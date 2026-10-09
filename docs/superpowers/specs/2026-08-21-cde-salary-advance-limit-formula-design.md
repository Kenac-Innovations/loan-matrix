# CDE Score-to-Limit Formula — Design Proposal

**Date:** 2026-08-21
**Related document:** Salary Advance – USSD Channel Extension Specification (GFL-SA-USSD-01, v1.0)
**Status:** Draft for Credit/Risk review — not yet approved
**Author:** Prepared with Claude at Pard's request

## 1. Why this document exists

GFL-SA-USSD-01 defines the Salary Advance limit structure as two tiers: every eligible customer gets a default limit of ZMW 500, and customers with a "favourable" CDE score can unlock an enhanced limit of up to ZMW 1,000 (§5.2). The specification lists three scoring inputs — repayment timeliness, borrowing frequency, and debt-to-income (DTI) ratio (§5.1) — but deliberately treats the CDE scoring logic itself as out of scope, since it "remains governed by the existing product programme" (§2.2).

That leaves a gap: nothing on paper says exactly what amount between ZMW 500 and ZMW 1,000 a given customer should get, or how the three inputs combine to produce it. This document proposes a deterministic formula that closes that gap, grounded in approaches that are standard in retail and microfinance credit scoring. It is written as an input to the Head of Credit / CDE owner, not as a replacement for their sign-off — per §2.2 of the USSD spec, any change to CDE scoring logic still needs to go through the existing product governance process.

## 2. Industry approaches, briefly

There isn't one universal formula for turning a score into a loan amount; lenders typically combine two or three of the following, and salary-advance products almost always include the second one:

**Weighted scorecard.** Each behavioural input is normalised to a 0–100 sub-score, combined with fixed weights into a composite score. This is the standard "points-based" approach behind most bureau and alternative-data scoring systems (a simplified cousin of FICO-style scorecards). It's easy to explain, easy to audit, and easy to recalibrate by adjusting weights rather than rewriting logic.

**Debt-service-to-income (DSTI) affordability cap.** Almost universal in payroll-linked and check-off lending: cap the loan so the total repayment doesn't exceed a fixed percentage of net salary, after accounting for existing obligations. Because GFL already prices the Salary Advance as a flat-fee, single-instalment product, this cap can be solved in closed form directly from the existing fee structure — no separate affordability engine is needed.

**Graduated/step-ladder lending.** Used by app-based lenders such as Tala, Branch, and various M-Shwari-style products: start every new customer at a floor, and increase the limit by a fixed increment or percentage after each on-time repayment cycle, resetting to the floor on default. This is simple and behaviourally reinforcing but doesn't use DTI or income at all, and by itself it wouldn't reflect the DTI input the spec already names as a scoring factor.

**Probability-of-default (PD) × exposure capping.** The most data-intensive option — model PD from repayment history, then size the loan so expected loss stays within a risk-appetite ceiling. This needs a meaningful volume of historical loan performance data to fit reliably, which GFL may not have yet for this specific channel. Worth revisiting once 12–18 months of Salary Advance performance data exists.

The recommendation below combines the first two — a weighted scorecard to answer "does this customer qualify for more," and a DSTI affordability formula to answer "how much can they actually service" — because that pairing directly operationalises the three inputs the spec already commits to (behavioural score decides eligibility for the enhanced tier; DTI decides how far the enhanced tier extends) and reuses GFL's existing pricing rather than introducing new economics.

## 3. Proposed formula

### Step 1 — Composite behavioural score (0–100)

Three sub-scores, each normalised to 0–100:

| Sub-score | Definition | Direction |
|---|---|---|
| Repayment Timeliness Score (RTS) | % of instalments across prior GFL facilities paid on or before the due date, over a trailing window (e.g. last 6 cycles). A late payment in the most recent cycle caps RTS at a low value, consistent with §5.1's "may trigger reversion to the default tier." | Higher = better |
| Borrowing Frequency Score (BFS) | Normalised measure of how often the customer has drawn and settled facilities in a trailing window. | Direction needs a Credit/Risk decision — see note below |
| DTI Score | `100 × max(0, 1 − DTI / DTI_max)`, where `DTI = existing monthly debt obligations ÷ verified net monthly salary` | Higher = better (lower DTI) |

**Open question for Credit/Risk:** the spec groups borrowing frequency with repayment timeliness under "credit behaviour and reliance" (§5.1) without saying whether more frequent borrowing is a positive signal (repeat, trusted customer) or a negative one (income shortfall / over-reliance on the product). The formula below treats it as negative by default — `BFS = 100 × (1 − min(draws_last_6_months / cap, 1))` — but this is a policy call, not a mathematical one, and should be confirmed before implementation.

Composite score:

```
S = w1·RTS + w2·BFS + w3·DTI_score
```

Suggested starting weights — `w1 = 0.40, w2 = 0.25, w3 = 0.35` — weighting repayment history highest, since it's the strongest predictor of near-term default risk in most behavioural scorecards, while still giving DTI real weight given it's a direct affordability signal. These are calibration parameters, not fixed values; GFL should tune them against its own loss experience once data is available.

### Step 2 — Tier gate

```
Enhanced-tier eligible  IF  S ≥ SCORE_GATE (suggested: 60)  AND  DTI ≤ DTI_max (suggested: 30%)  AND  no active arrears
Otherwise               →  Default tier, flat ZMW 500 (per §5.2 — no formula needed here)
```

The hard DTI cap alongside the score gate matches §5.1's wording that "a high DTI constrains or prevents access to the enhanced tier" — i.e. DTI is not just one input diluted into a blended score, it can independently block the enhanced tier regardless of how well the customer scores elsewhere.

### Step 3 — Amount within the enhanced tier

Two ceilings are computed and the lower one wins — the score tells you what the customer has earned, affordability tells you what they can safely carry:

**(a) Score-scaled ceiling** — linear interpolation from the gate threshold up to a perfect score:

```
ScoreCeiling = 500 + (1000 − 500) × (S − SCORE_GATE) / (100 − SCORE_GATE)
```

**(b) Affordability ceiling** — solved directly from GFL's existing Salary Advance pricing (25% flat interest, ZMW 50 CRB fee, ZMW 46.50 service fee, per §3):

```
Total repayable(P) = 1.25 × P + 96.50
Available capacity  = (Net monthly salary × DSTI_max) − Existing monthly debt obligations
AffordabilityCeiling = (Available capacity − 96.50) / 1.25
```

**Final approved limit:**

```
ApprovedLimit = clamp( MIN(ScoreCeiling, AffordabilityCeiling), 0, 1000 )
```

rounded down to a clean increment for USSD display (suggested: nearest ZMW 50).

## 4. Worked examples

Using `w = (0.40, 0.25, 0.35)`, `SCORE_GATE = 60`, `DSTI_max = 30%`, rounded down to the nearest ZMW 50:

| Customer | Net salary | Existing debt | RTS | BFS | DTI | Composite S | Score ceiling | Affordability ceiling | **Approved limit** |
|---|---|---|---|---|---|---|---|---|---|
| A — strong, low debt | 4,000 | 0 | 100 | 75 | 0.0% | 93.8 | 922 | 883 | **850** |
| B — thin affordability | 1,500 | 200 | 100 | 50 | 13.3% | 71.9 | 649 | 123 | **100** |
| D — high income, some debt | 6,000 | 500 | 90 | 60 | 8.3% | 76.3 | 704 | 963 | **700** |
| E — borderline score | 2,500 | 150 | 65 | 40 | 6.0% | 64.0 | 550 | 403 | **400** |
| C — first-time / unscored | — | — | — | — | — | — | — | — | **500** (default tier, per §5.2's unscored-customer rule) |

Customer B is deliberately included because it exposes a real gap: their behavioural score clears the enhanced-tier gate, but their affordability ceiling (ZMW 123) comes out *below* the ZMW 500 default-tier floor that §5.2 says every eligible customer gets automatically. The spec's default-tier guarantee doesn't currently account for very low net income relative to existing debt. Two ways to resolve this, either of which is a Credit/Risk decision rather than a formula fix: add a minimum net-income or minimum-disposable-income screen at the eligibility stage (§4), so a customer in this position is declined outright rather than defaulted to 500; or accept that the ZMW 500 default is a fixed underwriting floor the business is willing to carry regardless of affordability math, in which case the formula should simply floor `ApprovedLimit` at 500 whenever the customer is eligible at all. This is worth flagging to whoever owns the CDE logic before implementation.

## 5. Notes for implementation

Everything above is parameterised — `w1/w2/w3`, `SCORE_GATE`, `DSTI_max`, the rounding increment, and the direction of BFS — so it can live as configuration rather than hard-coded logic, similar to how `loan-matrix`'s tenant-settings pattern already externalises other product rules. Since §2.2 places CDE scoring logic outside this USSD spec's scope, this formula should be reviewed and formally adopted through the existing product/credit governance process (the same sign-off chain as §12 of GFL-SA-USSD-01 — Head of Credit, Head of ICT, Managing Director) before it's wired into the live CDE.

## 6. Summary of open decisions for Credit/Risk

1. Confirm the sign/shape of the borrowing-frequency sub-score (rewards repeat use vs. penalises reliance).
2. Confirm starting weights `w1/w2/w3` and the `SCORE_GATE` threshold (60 here is illustrative).
3. Confirm `DSTI_max` (30% here is illustrative) against GFL's credit policy and applicable Bank of Zambia guidance.
4. Decide how to handle the case where the affordability ceiling falls below the ZMW 500 default floor (see §4, Customer B).
5. Confirm the USSD display rounding increment (nearest ZMW 50 suggested, to keep menu options clean).
