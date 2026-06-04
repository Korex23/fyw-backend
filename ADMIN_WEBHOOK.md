# Admin — Webhook Events

How payment notifications from Flutterwave are received, stored, and surfaced to the admin dashboard.

## Background

When a payment completes, Flutterwave calls our webhook (`POST /api/webhooks/flutterwave`). Every delivery is recorded in a `WebhookEvent` collection — successful or not — so the admin can audit exactly what the gateway sent and when. This is the source of truth for "did the notification actually arrive?" when a payment looks stuck.

- Each event is deduped by a **stable key** (`<event>:<transactionId>`), so Flutterwave retries of the same charge don't create duplicate rows or double-credit a payment.
- Crediting itself is idempotent; the event log is just the record of what was received.

Both endpoints below require the admin token:

```
Authorization: Bearer <token>
```

---

## 1. List webhook events

```
GET /api/admin/webhook-events
```

Returns webhook deliveries, newest first. `rawPayload` is omitted from the list to keep it light — fetch a single event for the full payload.

**Query params** (all optional):

| Param | Default | Meaning |
| --- | --- | --- |
| `page` | `1` | page number |
| `limit` | `20` | rows per page |
| `event` | — | filter by event type, e.g. `charge.completed` |
| `reference` | — | show every delivery for one payment (its `tx_ref`) |

**Response**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "_id": "665c...",
        "eventId": "charge.completed:123456789",
        "reference": "FYW-1a2b3c",
        "event": "charge.completed",
        "processedAt": "2026-06-02T10:15:02.000Z",
        "createdAt": "2026-06-02T10:15:02.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 42, "pages": 3 }
  }
}
```

| Field | Meaning |
| --- | --- |
| `eventId` | stable dedup key — `<event>:<flutterwave transaction id>` |
| `reference` | the payment's `tx_ref` (links the event to a Payment / Student / Group) |
| `event` | Flutterwave event type (e.g. `charge.completed`) |
| `processedAt` / `createdAt` | when we received and stored it |

---

## 2. Webhook event details

```
GET /api/admin/webhook-events/:id
```

`:id` is the event's `_id`. Returns the full record **including `rawPayload`** — the complete JSON body Flutterwave sent. Use this to debug a specific delivery.

**Response**
```json
{
  "success": true,
  "data": {
    "_id": "665c...",
    "eventId": "charge.completed:123456789",
    "reference": "FYW-1a2b3c",
    "event": "charge.completed",
    "processedAt": "2026-06-02T10:15:02.000Z",
    "createdAt": "2026-06-02T10:15:02.000Z",
    "rawPayload": {
      "event": "charge.completed",
      "data": {
        "id": 123456789,
        "tx_ref": "FYW-1a2b3c",
        "status": "successful",
        "amount": 55101,
        "customer": { "email": "ada@x.com" }
      }
    }
  }
}
```

`404` (`Webhook event not found`) if the id doesn't exist.

---

## Frontend guidance

- Add a **Webhook Events** (or "Payment Notifications") page: a table of event type, `reference`, and received-at, newest first, paginated.
- Add a **reference filter** so the admin can pull every delivery for a payment that looks stuck — e.g. paste a `tx_ref` from the student/group detail page.
- Row click → detail view that pretty-prints `rawPayload` for debugging.
- Cross-link: from a student/group payment, link to `?reference=<tx_ref>` on this page to see whether/when the webhook arrived.

## Notes

- Rows created before the stable-key change carry an older `eventId` format; harmless, no migration needed.
- A delivery being **recorded** means the signature passed and we stored it. Whether it credited a payment depends on the event being `charge.completed` with `status: successful` and a matching Payment — check the Payment's status alongside the event.
