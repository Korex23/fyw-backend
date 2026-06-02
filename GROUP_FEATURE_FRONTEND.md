# Group Feature — Frontend Implementation Guide

Base URL: `/api`

The group package is a fixed bundle: **3 members → Full Experience (all 5 days) → ₦150,000 total.**
Members can pay in installments (part-payment). The group is only "complete" once the full ₦150,000 lands — at that point all 3 members are marked fully paid and emailed their invites.

> **See `GROUP_FEATURE_UPDATES.md` for recent changes:** the total is now ₦162,000 (10% group discount) and each member now returns `share` / `totalPaid` / `outstanding`.

- **User-side** group endpoints (`/api/group/*`) are **public** — no auth header.
- **Admin** endpoints (`/api/admin/*`) require `Authorization: Bearer <token>` (see §B.0).

---

## A. User Side

Flow: **Register members → Pay (full or partial) → Return & verify → Status page (resume here to pay the balance).**
Persist the returned `groupId` in `localStorage` so a user can come back and finish paying.

---

### A.1 Register the group

```
POST /api/group/register
```

**Body**

```json
{
  "payerEmail": "payer@example.com",
  "members": [
    {
      "matricNumber": "190408026",
      "fullName": "Ada Obi",
      "gender": "female",
      "email": "ada@x.com",
      "phone": "0801..."
    },
    {
      "matricNumber": "210411111",
      "fullName": "Tomi Bello",
      "gender": "male",
      "email": "tomi@x.com"
    },
    { "matricNumber": "190422222", "fullName": "Ife Cole", "gender": "female" }
  ]
}
```

**Validate before submit (the API enforces all of these too):**

| Field          | Rule                                                                                |
| -------------- | ----------------------------------------------------------------------------------- |
| `payerEmail`   | required, valid email — billed by Flutterwave, gets receipts                        |
| members        | exactly **3** — render 3 fixed cards, no add/remove                                 |
| `matricNumber` | `^(1904\|2104)\d{5}$` (starts `1904`/`2104`, 9 digits total). All 3 **different**.  |
| `fullName`     | required, min 2 chars                                                               |
| `gender`       | required, `"male"` or `"female"` (lowercase). No default.                           |
| `email`        | optional but **recommend it** — no email = that member gets no invite/notifications |
| `phone`        | optional                                                                            |

> No package picker, no day-selection UI — the package is fixed to Full Experience.

**Success → `200`**

```json
{
  "success": true,
  "message": "Group registered successfully. Use the groupId to initialize payment.",
  "data": {
    "groupId": "665f...",
    "totalAmount": 150000,
    "outstanding": 150000,
    "members": [
      {
        "matricNumber": "190408026",
        "fullName": "Ada Obi",
        "email": "ada@x.com"
      }
    ]
  }
}
```

Store `groupId`, go to the payment step.

**What the user sees / errors:** A member can't join if they already have their own registration. The API returns `400` naming each offender:

```
These members cannot join a group: 190408026 (already fully paid), 210411111 (has an individual payment in progress). Resolve their existing registration first.
```

Possible per-member reasons:

- `already fully paid`
- `already in another group`
- `has already made an individual payment`
- `has an individual payment in progress` (an individual checkout is mid-flight)

Show this inline and let the payer swap the named member(s) out before retrying. A member who exists but has never paid is fine — they're converted to the group package, nothing lost.

---

### A.2 Initialize a payment (full or partial)

```
POST /api/group/:groupId/pay
```

**Body**

```json
{ "amount": 50000, "payerEmail": "payer@example.com" }
```

- `amount` must be **> 0** and **≤ amount left to pay**.
- For full payment, set `amount` to the current `outstanding` from the status call (§A.4).
- Suggested UI presets: **Pay in full**, **Pay half**, **Custom amount**.
- `payerEmail` should be one of the members' emails when possible — the payment is attributed to the member whose email matches (else the first member). Affects who the payment shows under in admin.

**Success → `200`**

```json
{
  "success": true,
  "message": "Group payment initialized successfully",
  "data": {
    "authorization_url": "https://checkout.flutterwave.com/...",
    "reference": "FYW-...",
    "amount": 50000,
    "outstanding": 100000
  }
}
```

**Redirect the browser to `authorization_url`.** Optionally stash `reference` for verify.

> **Fee:** the customer is charged ~2% above `amount` at the gateway so the full `amount` lands net. Show "a small processing fee applies" near the pay button. Track the balance against `amount` (net), not the gateway charge.

**What the user sees / errors (`400`):**

- `Amount must be greater than 0`
- `This group has already fully paid`
- `This group's balance is already covered by a completed or in-progress payment. Please wait for it to settle.`
- `Amount exceeds the ₦100,000 left to pay. Part of the balance may be covered by a payment already in progress — try again shortly if that one is abandoned.`

> **Why "in progress" matters:** the backend prevents overpayment by counting in-flight payments against the balance. If member A starts paying ₦150,000, member B can't also start a ₦150,000 payment — they'll get the "exceeds amount left" error. An abandoned checkout frees its slice after ~30 minutes. So if a user sees this and believes the other payment was abandoned, tell them to retry in a few minutes.

---

### A.3 Return from Flutterwave & verify

Flutterwave redirects to `/payment/verify?...&tx_ref=<reference>`. Read `tx_ref` and call the **shared** verify endpoint (same one individuals use):

```
GET /api/payments/verify?reference=<tx_ref>
```

This confirms the transaction **and** applies it to the group on the backend (advances the total, updates member statuses, and — when the group hits ₦150,000 — generates invites + sends completion emails). The frontend does nothing group-specific here beyond calling it. It's safe to call once; re-calling the same reference is a no-op.

After it returns, fetch the status (§A.4) to render the result.

---

### A.4 Group status page (resume point)

```
GET /api/group/:groupId
```

**Response**

```json
{
  "success": true,
  "data": {
    "groupId": "665f...",
    "paymentStatus": "PARTIALLY_PAID",
    "totalAmount": 150000,
    "totalPaid": 50000,
    "outstanding": 100000,
    "payerEmail": "payer@example.com",
    "members": [
      {
        "matricNumber": "190408026",
        "fullName": "Ada Obi",
        "email": "ada@x.com",
        "paymentStatus": "PARTIALLY_PAID",
        "hasInvite": false,
        "inviteUrl": null
      }
    ],
    "createdAt": "2026-06-02T..."
  }
}
```

**What the user sees:**

- Progress bar from `totalPaid / totalAmount`, with `outstanding` called out.
- Members list with each `paymentStatus`; once `hasInvite` is true, a **View / Download invite** link (`inviteUrl`).
- A status badge: `NOT_PAID` / `PARTIALLY_PAID` / `FULLY_PAID`.
- **Pay balance** button (use `outstanding` as the suggested amount) — hide it when `paymentStatus === "FULLY_PAID"`.
- When fully paid: "All 3 invites have been emailed" + show each member's invite.

---

### User-side build checklist

- [ ] Group entry point on the package screen
- [ ] 3-member form with field validation (matric regex, distinct matrics, gender required)
- [ ] `POST /api/group/register` → store `groupId`; handle per-member blocked errors
- [ ] Payment step (full/half/custom, capped at `outstanding`) → `POST /api/group/:groupId/pay` → redirect to `authorization_url`
- [ ] Verify page reads `tx_ref` → `GET /api/payments/verify`
- [ ] Status page (`GET /api/group/:groupId`) — progress bar, member invites, pay-balance loop
- [ ] Persist `groupId` for resume
- [ ] Surface the overpayment / in-progress errors with a "try again shortly" hint

---

## B. Admin Side

### B.0 Auth (required for every admin call)

```
POST /api/admin/auth/login
```

**Body** `{ "email": "...", "password": "..." }`
**Response** `{ "success": true, "data": { "token": "<jwt>", "admin": { "email": "..." } } }`

Store the token; send it on **every** admin request:

```
Authorization: Bearer <token>
```

On any `401`, clear the token and redirect to login.

---

### B.1 Dashboard metrics — `groups` block

```
GET /api/admin/metrics
```

**Response (relevant part)**

```json
{
  "success": true,
  "data": {
    "totalStudents": 120,
    "fullyPaidCount": 80,
    "partiallyPaidCount": 25,
    "notPaidCount": 15,
    "totalRevenue": 5400000,
    "outstandingTotal": 900000,
    "groups": {
      "totalGroups": 12,
      "fullyPaidGroups": 7,
      "pendingGroups": 5,
      "groupRevenue": 1050000
    }
  }
}
```

Render 4 cards: **Total Groups**, **Fully Paid Groups**, **Pending Groups**, **Group Revenue (₦)**.
Note: `outstandingTotal` already includes group outstanding and excludes group members from individual math — don't re-add. `groupRevenue` sums only fully-paid groups.

---

### B.2 Groups list

```
GET /api/admin/groups?page=1&limit=20&status=FULLY_PAID
```

- `page` (default 1), `limit` (default 20)
- `status` — optional; only `FULLY_PAID` or `NOT_PAID` are honored, anything else returns all

**Response**

```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "_id": "665f...",
        "payerEmail": "payer@example.com",
        "members": [
          {
            "fullName": "Ada Obi",
            "matricNumber": "190408026",
            "email": "ada@x.com"
          }
        ],
        "totalAmount": 150000,
        "totalPaid": 50000,
        "paymentStatus": "PARTIALLY_PAID",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 12, "pages": 1 }
  }
}
```

Table: **Payer email**, **Members** (3 name/matric chips), **Paid / Total** (`₦50,000 / ₦150,000`), **Status badge**, **Created**. Row → group detail. Add a status filter (All / Fully paid / Not paid) + pagination.

---

### B.3 Group detail

```
GET /api/admin/groups/:id
```

**Response**

```json
{
  "success": true,
  "data": {
    "_id": "665f...",
    "payerEmail": "payer@example.com",
    "totalAmount": 150000,
    "totalPaid": 50000,
    "paymentStatus": "PARTIALLY_PAID",
    "members": [
      {
        "studentId": "665a...",
        "fullName": "Ada Obi",
        "matricNumber": "190408026",
        "email": "ada@x.com",
        "paymentStatus": "PARTIALLY_PAID",
        "totalPaid": 0,
        "hasInvite": false,
        "inviteUrl": null
      }
    ],
    "payments": [
      {
        "_id": "...",
        "amount": 50000,
        "reference": "FYW-...",
        "status": "SUCCESS",
        "createdAt": "..."
      }
    ],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

Layout:

- **Header:** payer email, status badge, progress (`totalPaid / totalAmount`, outstanding).
- **Members:** 3 cards — name, matric, email, per-member status, invite link when `hasInvite`. Each member's `studentId` links to the existing student-detail page (where the admin can resend/regenerate that member's invite).
- **Payments:** the `payments` array as a table — amount, reference, status, date — the installment history. (Each successful payment is attributed to the member whose email matched the payer.)

> On full payment each member's `totalPaid` reads ₦50,000 (their share of ₦150,000), so member totals sum to the group total.

---

### B.4 Students list / CSV — group flag

Group members carry `groupRegistrationId`. Use it to show a **Group** vs **Individual** badge in the student table and link group students to §B.3.

CSV export already includes the columns `Registration Type` (`Group`/`Individual`) and `Group ID`:

```
GET /api/admin/export.csv      (Bearer token)
```

---

### Admin-side build checklist

- [ ] Login → store token, attach Bearer header, handle 401
- [ ] Dashboard: 4 group cards from `metrics.groups`
- [ ] Groups list with status filter + pagination
- [ ] Group detail — members, invites, payments history
- [ ] Member cards → existing student detail (reuse resend/regenerate)
- [ ] Student table: Group/Individual badge + link to group detail

---

## Reference

**Status values**

| Value            | Meaning                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `NOT_PAID`       | Created, nothing paid                                            |
| `PARTIALLY_PAID` | Some of ₦150,000 received; no invites yet                        |
| `FULLY_PAID`     | Full ₦150,000 received; all members fully paid + invites emailed |

**Endpoints**

| Method | Endpoint                          | Auth   | Purpose                                                               |
| ------ | --------------------------------- | ------ | --------------------------------------------------------------------- |
| POST   | `/api/group/register`             | public | Create a 3-member group → `groupId`                                   |
| POST   | `/api/group/:groupId/pay`         | public | Init full/partial payment → `authorization_url` (rejects overpayment) |
| GET    | `/api/group/:groupId`             | public | Group status + members + invites                                      |
| GET    | `/api/payments/verify?reference=` | public | Verify a returning payment (auto-applies to the group)                |
| POST   | `/api/admin/auth/login`           | public | Admin login → Bearer token                                            |
| GET    | `/api/admin/metrics`              | bearer | Dashboard stats incl. `groups` block                                  |
| GET    | `/api/admin/groups`               | bearer | Paginated groups list (filter by status)                              |
| GET    | `/api/admin/groups/:id`           | bearer | Group detail + member statuses + payments                             |
| GET    | `/api/admin/export.csv`           | bearer | CSV incl. `Registration Type` / `Group ID`                            |
