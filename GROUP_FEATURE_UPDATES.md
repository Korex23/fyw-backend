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

## 3. Group members can't pay individually

A student who belongs to a group can no longer use the normal individual payment flow. `POST /api/payments/initialize` for such a student returns `400`:

```
This student is part of a group registration and must pay through the group.
```

Frontend: if you offer an individual "Pay" action anywhere a group member could appear, hide/disable it and point them to the group payment flow (`POST /api/group/:groupId/pay`).

## 4. Admin individual view shows the group share

`GET /api/admin/students/:id` now returns the member's **group share** instead of the standalone package price for group members:

- `effectivePrice` — new field: `54000` for a group member (was effectively `60000` via `package.price`)
- `outstanding` — now computed against the share (`effectivePrice − totalPaid`)

Frontend: show the price/balance using **`effectivePrice` and `outstanding`** from the response, not `package.price`. For a non-group student `effectivePrice` equals their normal (possibly discounted) package price, so it's safe to use everywhere.

## 5. Group payment redirect carries a group flag

See **`GROUP_REDIRECT_URI_PLAN.md`** — the redirect back from Flutterwave for a group payment now includes `type=group` and `groupId=<id>` query params so the frontend can route to the correct group status page instead of the payer's dashboard.

## 6. New admin actions: delete group & edit student

Both require the admin `Authorization: Bearer <token>`.

### Delete a group (and its members)

```
DELETE /api/admin/groups/:id
```

Deletes the group registration, **all 3 member student records, and their payments**. Irreversible — gate it behind a confirm dialog.

**Response**
```json
{
  "success": true,
  "message": "Group deleted along with 3 member(s) and 2 payment(s).",
  "data": { "deletedMembers": 3, "deletedPayments": 2 }
}
```

Frontend: add a **Delete group** button on the group detail page (§B.3) → confirm modal → on success, navigate back to the groups list and toast the message.

### Edit a student's details

```
PATCH /api/admin/students/:id
```

**Body** — send only the fields you're changing (all optional, but at least one required):
```json
{
  "fullName": "Ada N. Obi",
  "email": "ada.new@x.com",
  "phone": "08030000000",
  "gender": "female",
  "department": "Civil Engineering",
  "matricNumber": "190408026"
}
```

- `matricNumber` must match `^(1904|2104)\d{5}$` and be unique — a clash returns `400 Matric number ... is already in use by another student`.
- Only profile fields are editable here; package/payment state is untouched.
- If the student is a group member, their name/matric/email are also synced into the group's member list automatically.

**Response** → `200` with the updated `student` object.

Frontend: add an **Edit** action on the student detail page with a form pre-filled from the current values; submit only changed fields.

## 7. Nothing else changes

Other endpoints, request bodies, and the register/pay/verify flow are unchanged.
