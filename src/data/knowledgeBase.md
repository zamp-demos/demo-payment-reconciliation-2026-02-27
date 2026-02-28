# Stripe Payment Reconciliation - Knowledge Base

## Overview
This knowledge base covers the automated reconciliation of Stripe payments against internal accounting records. The AI agent handles matching, currency conversion, dispute detection, and refund reconciliation.

## Process Scope

### What Gets Reconciled
- **Subscription payments**: Recurring charges from Stripe Billing
- **One-time charges**: Direct charges via Stripe Payments API
- **Refunds**: Full and partial refunds, including multi-tranche refunds
- **Disputes**: Chargebacks, inquiries, and fraud claims
- **Payouts**: Stripe-to-bank transfer matching

### Data Sources
- **Stripe Dashboard/API**: Payment intents, charges, balance transactions, disputes, refunds
- **Internal ERP**: Invoices, credit memos, journal entries
- **Bank statements**: Payout confirmation and settlement records

## Reconciliation Rules

### Amount Matching
- Exact match required for single-currency transactions
- FX tolerance: ±$5.00 or ±0.5% (whichever is greater) for multi-currency
- Partial refunds must sum to the total credit memo amount (±$1.00 tolerance)

### Status Mapping
| Stripe Status | Internal Status | Action |
|--------------|----------------|--------|
| succeeded | Paid | Auto-reconcile |
| pending | Processing | Hold for 48h, then escalate |
| failed | Rejected | Flag for review |
| disputed | Under Review | Trigger dispute workflow |
| refunded | Credited | Match to credit memo |
| partially_refunded | Partially Credited | Validate refund tranches |

### Currency Conversion
- Use Stripe's balance transaction exchange rate (not market rate)
- Record FX gain/loss in GL account 4200-FX
- All conversions documented with rate, source amount, and converted amount

## Dispute Handling

### Dispute Response SLA
- **Initial review**: Within 4 hours of detection
- **Evidence submission**: Within 48 hours
- **Final response**: 5 business days before Stripe deadline

### Evidence Types
- Delivery confirmation / tracking numbers
- Customer communication logs
- Service usage logs
- Terms of service / refund policy
- Invoice and payment receipts

### Dispute Reasons and Recommended Actions
| Reason | First Action |
|--------|-------------|
| product_not_received | Pull delivery tracking |
| duplicate | Cross-reference charge IDs |
| fraudulent | Check IP/device fingerprint |
| subscription_canceled | Verify cancellation date |
| credit_not_processed | Check refund queue |

## Refund Reconciliation

### Multi-Tranche Refunds
When Stripe shows multiple partial refunds against a single charge:
1. Sum all refund amounts
2. Compare to internal credit memo total
3. If within tolerance: auto-reconcile with note
4. If outside tolerance: flag for manual review

### Refund Timing
- Stripe refunds: 5-10 business days to customer
- Internal credit memo: Posted same day
- Bank settlement: 2-3 business days after Stripe processes

## Exception Handling

### Common Exceptions
1. **Rounding differences**: FX conversion rounding (usually <$1)
2. **Split payments**: Customer pays with multiple methods
3. **Partial captures**: Auth amount differs from capture amount
4. **Metadata mismatch**: Invoice number not in Stripe metadata

### Escalation Path
1. Auto-resolve if within tolerance
2. Flag "Needs Attention" if human approval required
3. Flag "Needs Review" if pattern is unusual
4. Email finance team if >$500 discrepancy

## Stripe API Reference

### Key Objects
- **PaymentIntent**: The intent to collect payment
- **Charge**: The actual charge against a payment method
- **BalanceTransaction**: Stripe's ledger entry (includes fees, FX)
- **Dispute**: A chargeback or inquiry filed by the cardholder
- **Refund**: A reversal of a charge (full or partial)

### Useful Endpoints
- `GET /v1/charges/{id}` - Charge details with metadata
- `GET /v1/balance_transactions/{id}` - FX rate and fee breakdown
- `GET /v1/disputes/{id}` - Dispute status and evidence
- `GET /v1/refunds?charge={id}` - All refunds for a charge

## Team & Contacts
- **Finance Team**: finance-team@stripe.com
- **Dispute Specialist**: disputes@stripe.com
- **Treasury/Payouts**: treasury@stripe.com
- **Escalation**: ap-escalation@stripe.com
