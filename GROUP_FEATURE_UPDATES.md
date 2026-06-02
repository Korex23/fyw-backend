# Group Feature — Frontend Update Notes

Small changes to apply on top of `GROUP_FEATURE_FRONTEND.md`.

## 1. Group total is now ₦162,000 (was ₦150,000)

3 × ₦60,000 = ₦180,000, less a **10% group discount = ₦162,000**. Each member's share is **₦54,000**.

- Don't hardcode the total anywhere — read `totalAmount` / `outstanding` from the API responses.
- Update any copy that shows the price (e.g. "Register as a group — ₦162,000").
- Existing groups created before this change keep their old ₦150,000 total; new ones are ₦162,000. So always trust `totalAmount` per group rather than a constant.

## 2. Per-member balance is now returned

The members array in **two** endpoints now includes per-member money fields so you can show how much each member has paid / still owes:

- `GET /api/group/:groupId` (user status page)
- `GET /api/admin/groups/:id` (admin group detail)

**New fields on each member:**

| Field | Meaning |
| --- | --- |
| `share` | this member's portion of the total (`totalAmount / 3`, e.g. `54000`) |
| `totalPaid` | how much has been applied to this member so far (the group's collected amount split evenly) |
| `outstanding` | `share − totalPaid` — **how much this member still has to pay** |

Example member object:
```json
{
  "matricNumber": "190408026",
  "fullName": "Ada Obi",
  "email": "ada@x.com",
  "paymentStatus": "PARTIALLY_PAID",
  "share": 54000,
  "totalPaid": 18000,
  "outstanding": 36000,
  "hasInvite": false,
  "inviteUrl": null
}
```

**What to render:**
- Admin group detail — add a per-member **Paid / Left** column (e.g. `₦18,000 paid · ₦36,000 left`), not just the `PARTIALLY_PAID` badge.
- User status page — optionally show each member's remaining amount the same way.

> Note: group payments aren't tied to a single member — a part-payment is split **evenly** across all 3 members, so each member's `totalPaid`/`outstanding` move together. On full payment every member shows `totalPaid: 54000`, `outstanding: 0`.

## 3. Nothing else changes

Endpoints, request bodies, the register/pay/verify flow, and all error messages are unchanged. Just the amount and the new per-member fields.
