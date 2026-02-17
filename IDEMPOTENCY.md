# Webhook Idempotency Implementation

## Overview

This document explains how webhook idempotency is guaranteed in the Final Year Week backend API to prevent duplicate payment processing.

## Problem Statement

Payment webhooks from Flutterwave can be delivered multiple times due to:

- Network retries
- Timeout retries
- Manual webhook resends
- System failures during processing

Without proper idempotency, this could result in:

- Double-crediting payments
- Multiple invite generations
- Duplicate email notifications
- Incorrect payment status updates

## Solution Architecture

### 1. Database-Level Idempotency

#### Unique Indexes

```typescript
// WebhookEvent Model
WebhookEventSchema.index({ eventId: 1, reference: 1 }, { unique: true });

// Payment Model
PaymentSchema.index({ reference: 1 }, { unique: true });
```

**How it works:**

- MongoDB enforces uniqueness at the database level
- Attempting to insert a duplicate will throw a `MongoError` with code `11000`
- This provides atomic idempotency even under concurrent webhook deliveries

#### WebhookEvent Collection

```typescript
{
  eventId: string; // Flutterwave event ID + timestamp
  reference: string; // Payment reference
  event: string; // Event type (charge.success)
  processedAt: Date;
  rawPayload: any; // Full webhook data
}
```

**Purpose:**

- Tracks every webhook event received
- Prevents processing the same event twice
- Provides audit trail for debugging

### 2. Application-Level Checks

#### Pre-Processing Check

```typescript
// Check if event already processed
const existingEvent = await WebhookEvent.findOne({
  eventId,
  reference: data.reference,
});

if (existingEvent) {
  logger.info(`Webhook event ${eventId} already processed`);
  return; // Early exit
}
```

**Benefits:**

- Fast check before any processing
- Avoids unnecessary computation
- Returns immediately if duplicate

#### Atomic Event Recording

```typescript
try {
  await WebhookEvent.create({
    eventId,
    reference: data.reference,
    event,
    processedAt: new Date(),
    rawPayload: eventData,
  });
} catch (error: any) {
  if (error.code === 11000) {
    // Duplicate detected by database
    logger.info(`Webhook event ${eventId} already processed (duplicate)`);
    return;
  }
  throw error;
}
```

**How it works:**

1. Attempts to insert webhook event record
2. If duplicate exists, MongoDB rejects with error code 11000
3. Application catches this and returns without processing
4. This is **atomic** - either the insert succeeds or fails completely

### 3. Payment-Level Idempotency

#### Status Check

```typescript
if (payment.status === TransactionStatus.SUCCESS) {
  logger.info(`Payment ${data.reference} already processed`);
  return;
}
```

**Purpose:**

- Additional safety layer
- Prevents re-processing already successful payments
- Useful for payment verification endpoint as well

#### Amount Capping

```typescript
// Cap the credited amount to package price
const newTotalPaid = Math.min(student.totalPaid + amount, pkg.price);
student.totalPaid = newTotalPaid;
```

**Purpose:**

- Prevents overpayment even if duplicate somehow processes
- Business logic safety net

## Complete Flow

### First Webhook Delivery

```
1. Webhook arrives → Verify signature ✓
2. Generate eventId: "123456-charge.success-1234567890"
3. Check WebhookEvent collection → Not found ✓
4. Create WebhookEvent record → Success ✓
5. Find Payment by reference → Found ✓
6. Check payment status → PENDING ✓
7. Update payment to SUCCESS ✓
8. Credit student account ✓
9. Generate invites ✓
10. Send email ✓
11. Respond 200 OK to Flutterwave
```

### Duplicate Webhook Delivery

```
1. Webhook arrives → Verify signature ✓
2. Generate eventId: "123456-charge.success-1234567890" (same)
3. Check WebhookEvent collection → Found! ✗
4. Return immediately (no processing)
5. Respond 200 OK to Flutterwave
```

### Race Condition (Concurrent Webhooks)

```
Thread A                          Thread B
├─ Webhook arrives               ├─ Webhook arrives
├─ Check WebhookEvent → Not found├─ Check WebhookEvent → Not found
├─ Create WebhookEvent → SUCCESS │
                                 ├─ Create WebhookEvent → FAILS (11000)
├─ Process payment               ├─ Return immediately
├─ Credit student                │
└─ Return 200                    └─ Return 200
```

**Result:** Only one thread successfully processes the payment due to database unique constraint.

## Testing

### Test 1: Duplicate Webhook Processing

```bash
npm run test
```

The test:

1. Creates a test student and payment
2. Processes a webhook event
3. Attempts to process the same webhook again
4. Verifies payment only credited once
5. Verifies webhook only recorded once

### Test 2: Different EventID, Same Reference

```bash
npm run test
```

The test:

1. Processes webhook with eventId1
2. Processes webhook with eventId2 but same reference
3. Verifies only one WebhookEvent created per unique (eventId, reference)
4. Verifies payment still only credited once

## Edge Cases Handled

### 1. Network Retry

**Scenario:** Flutterwave doesn't receive 200 OK, retries webhook
**Handling:** WebhookEvent duplicate detection catches it

### 2. Manual Resend

**Scenario:** Admin manually resends webhook from Flutterwave dashboard
**Handling:** Same eventId detected, no reprocessing

### 3. Concurrent Deliveries

**Scenario:** Multiple webhook processes try to process simultaneously
**Handling:** Database unique constraint ensures atomic operation

### 4. Payment Already Successful

**Scenario:** Webhook arrives after payment already marked successful
**Handling:** Status check exits early

### 5. Different Event, Same Payment

**Scenario:** Multiple webhook events for same payment reference
**Handling:** Each unique (eventId, reference) pair recorded separately, but payment status check prevents double-credit

## Verification Endpoint Idempotency

The payment verification endpoint also implements idempotency:

```typescript
async verifyPayment(reference: string): Promise<IPayment> {
  const payment = await Payment.findOne({ reference });

  // If already successful, return existing payment
  if (payment.status === TransactionStatus.SUCCESS) {
    return payment; // No API call to Flutterwave
  }

  // Otherwise verify with Flutterwave
  const response = await flutterwaveClient.get(`/transactions/verify_by_reference?tx_ref=${reference}`);

  if (data.status === 'success') {
    await this.processSuccessfulPayment(payment, data);
  }

  return payment;
}
```

**Benefits:**

- Avoids unnecessary API calls to Flutterwave
- Returns instantly for already-verified payments
- Consistent behavior with webhook processing

## Monitoring & Debugging

### Logs

```typescript
logger.info(`Webhook event ${eventId} already processed`);
logger.info(`Payment ${reference} already verified`);
logger.warn(`Payment not found for webhook reference: ${reference}`);
```

### Database Queries

```javascript
// Check webhook events for a payment
db.webhookevents.find({ reference: "FYW-1234567890-ABCD" });

// Check duplicate attempts
db.webhookevents.aggregate([
  { $group: { _id: "$reference", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
]);

// Check payment history
db.payments.find({ reference: "FYW-1234567890-ABCD" });
```

## Best Practices Implemented

1. ✅ **Database Constraints**: Unique indexes prevent duplicates at DB level
2. ✅ **Early Exit**: Check for duplicates before processing
3. ✅ **Atomic Operations**: Use database constraints for race condition safety
4. ✅ **Status Checks**: Multiple layers of verification
5. ✅ **Logging**: Comprehensive logging for debugging
6. ✅ **Error Handling**: Graceful handling of duplicate errors
7. ✅ **Testing**: Automated tests verify idempotency

## Conclusion

The webhook idempotency implementation uses multiple layers of protection:

1. **Database-level uniqueness** (primary defense)
2. **Application-level checks** (performance optimization)
3. **Payment status validation** (business logic safety)

This approach ensures that no matter how many times a webhook is delivered, the payment is only processed once, providing reliable and consistent payment handling.


