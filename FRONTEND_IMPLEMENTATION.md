# Frontend Implementation Guide

## 1. Package Overview

| Code | Name               | Price   | Days                                                          |
| ---- | ------------------ | ------- | ------------------------------------------------------------- |
| `T`  | Two-Day Flex     | ₦30,000 | **Any 2 days** from Mon–Thu (Friday excluded, student picks both) |
| `C`  | Owambe Plus | ₦40,000 | Friday (fixed) + **1 day you pick** from Mon, Tue, Wed, or Thu |
| `F`  | Full Experience    | ₦60,000 | All 5 days (**no selection needed**)                          |

---

## 2. Gender Field — Required

`gender` is a **required field** on the identify/create student endpoint. Must always be included in the request body.

**Accepted values:** `"male"` or `"female"` (lowercase).

### Form UI

Add a gender selector to the registration/identification form. Treat it the same as `fullName` and `matricNumber` — required before submission.

```
Gender *
  ○ Male   ○ Female
```

### Validation

- Required — show an inline error if submitted without a selection.
- No default — force a deliberate choice.

---

## 3. Package Selection UI Changes

### Package `T` — Two-Day Flex (₦30,000)

- Show a picker for **2 days** — all options are from Mon–Thu only:
  - Monday (Corporate Day)
  - Tuesday (Denim Day)
  - Wednesday (Costume Day)
  - Thursday (Jersey Day)
- Friday must **not** appear as an option.
- The user must pick exactly **2** days.
- No pre-selected days — both choices are free.

---

### Package `C` — Owambe Plus (₦40,000)

- Friday is **always included** — show it as a pre-selected, disabled chip/badge.
- Show a picker for **1 additional day** with these options:
  - Monday (Corporate Day)
  - Tuesday (Denim Day)
  - Wednesday (Costume Day)
  - Thursday (Jersey Day)
- The user must pick exactly **1** day.

---

### Package `F` — Full Experience (₦60,000)

No change. Show all 5 days as included. No picker.

---

## 4. API Endpoints

### POST `/api/students/identify`

`gender` is required alongside `matricNumber`, `fullName`, and `packageCode`.

```json
// Two-Day Flex (T) — pick any 2 days from Mon–Thu
{
  "matricNumber": "ENG23001",
  "fullName": "Jane Doe",
  "gender": "female",
  "packageCode": "T",
  "email": "jane@example.com",
  "phone": "08012345678",
  "selectedDays": ["MONDAY", "WEDNESDAY"]
}
```

```json
// Owambe Plus (C) — send 1 non-Friday day; Friday is added automatically
{
  "matricNumber": "ENG23002",
  "fullName": "Ada Obi",
  "gender": "female",
  "packageCode": "C",
  "email": "ada@example.com",
  "phone": "08098765432",
  "selectedDays": ["MONDAY"]
}
```

```json
// Full Experience (F) — no selectedDays needed
{
  "matricNumber": "ENG23003",
  "fullName": "John Doe",
  "gender": "male",
  "packageCode": "F",
  "email": "john@example.com",
  "phone": "08011223344"
}
```

> `gender` is **always required** regardless of package chosen.
> `email` and `phone` are optional but recommended.

---

### POST `/api/students/select-package`

Gender is **not** required here — only updates the package/day selection for an already-identified student.

```json
// Switching to Two-Day Flex — pick any 2 days from Mon–Thu
{
  "matricNumber": "ENG23001",
  "packageCode": "T",
  "selectedDays": ["TUESDAY", "THURSDAY"]
}

// Switching to Owambe Plus — send 1 non-Friday day
{
  "matricNumber": "ENG23001",
  "packageCode": "C",
  "selectedDays": ["WEDNESDAY"]
}
```

---

### POST `/api/students/upgrade-package`

Gender is **not** required here.

```json
// T → C  (must include selectedDays for C — the non-Friday day)
{
  "matricNumber": "ENG23001",
  "newPackageCode": "C",
  "selectedDays": ["MONDAY"]
}

// T → F  or  C → F  (no selectedDays needed)
{
  "matricNumber": "ENG23001",
  "newPackageCode": "F"
}
```

---

## 5. Upgrade Paths

Upgrades are only allowed to a **higher-priced** package:

```
T (₦30k) → C (₦40k)   ✓
T (₦30k) → F (₦60k)   ✓
C (₦40k) → F (₦60k)   ✓
C (₦40k) → T (₦30k)   ✗  (lower price — blocked)
F (₦60k) → anything   ✗  (already highest)
```

Previously paid amounts are preserved across upgrades. Show the outstanding balance clearly.

---

## 6. GET `/api/students/packages` Response

Use `packageType` to drive UI logic — don't hardcode behaviour by `code`.

| `packageType`      | Day picker UI                                                      |
| ------------------ | ------------------------------------------------------------------ |
| `CORPORATE_PLUS`   | Picker for **2 days** from Mon–Thu (no pre-selection, no Friday)  |
| `CORPORATE_OWAMBE` | Friday (disabled/pre-selected) + picker for **1 day** from Mon–Thu |
| `FULL`             | All 5 days shown (disabled, no picker)                             |

Full response shape:

```json
[
  {
    "code": "T",
    "name": "Two-Day Flex",
    "packageType": "CORPORATE_PLUS",
    "price": 30000,
    "benefits": ["..."]
  },
  {
    "code": "C",
    "name": "Owambe Plus",
    "packageType": "CORPORATE_OWAMBE",
    "price": 40000,
    "benefits": ["..."]
  },
  {
    "code": "F",
    "name": "Full Experience",
    "packageType": "FULL",
    "price": 60000,
    "benefits": ["..."]
  }
]
```

---

## 7. Error Handling

### 7.1 Two distinct error shapes

Every error response has `success: false`. However the `message` field means **different things** depending on the source — you must handle both.

---

#### Shape A — Validation error (Zod, field-level)

Triggered when required fields are missing, wrong type, or wrong format. HTTP status is always `400`.

```json
{
  "success": false,
  "message": "[{\"field\":\"body.gender\",\"message\":\"Required\"},{\"field\":\"body.matricNumber\",\"message\":\"String must contain at least 5 character(s)\"}]"
}
```

> `message` is a **JSON-stringified array**. You must `JSON.parse(response.message)` to get field-level errors.

```js
if (response.success === false) {
  try {
    const fieldErrors = JSON.parse(response.message);
    // fieldErrors = [{ field: "body.gender", message: "Required" }, ...]
    fieldErrors.forEach(({ field, message }) => {
      const key = field.replace("body.", "");
      showFieldError(key, message);
    });
  } catch {
    // Not a validation error — treat message as a plain string
    showGlobalError(response.message);
  }
}
```

---

#### Shape B — App / service error (plain string)

Triggered by business logic, missing records, or server failures.

```json
{
  "success": false,
  "message": "Student not found"
}
```

Display `message` directly.

---

#### Shape C — Duplicate record (409)

```json
{
  "success": false,
  "message": "matricNumber already exists"
}
```

---

#### Shape D — Rate limited (429)

```json
{
  "success": false,
  "message": "Too many requests, please try again later"
}
```

Payment endpoints return: `"Too many payment requests, please try again later"`

---

#### Shape E — Server error (500)

```json
{
  "success": false,
  "message": "Internal server error"
}
```

Show a generic fallback. Do not retry automatically.

---

### 7.2 Per-endpoint error reference

---

#### `POST /api/students/identify`

**Validation errors — Shape A (400)**

| `field` | `message` | Cause |
|---------|-----------|-------|
| `body.matricNumber` | `"Required"` | Field missing |
| `body.matricNumber` | `"String must contain at least 5 character(s)"` | Too short |
| `body.fullName` | `"Required"` | Field missing |
| `body.fullName` | `"String must contain at least 2 character(s)"` | Too short |
| `body.gender` | `"Required"` | Field missing |
| `body.gender` | `"Invalid enum value. Expected 'male' \| 'female', received '...'"` | Wrong value sent |
| `body.packageCode` | `"Required"` | Field missing |
| `body.packageCode` | `"String must contain exactly 1 character(s)"` | Code is not 1 character |
| `body.email` | `"Invalid email"` | Malformed email (optional field) |

**App errors — Shape B**

| Status | `message` | Cause |
|--------|-----------|-------|
| `404` | `"Package with code X not found"` | `packageCode` doesn't match any package |
| `400` | `"Two-Day Flex package does not include Friday. Please select 2 days from Monday to Thursday"` | Package `T` — Friday was included in `selectedDays` |
| `400` | `"Two-Day Flex package requires exactly 2 days (any days except Friday)"` | Package `T` — wrong number of days sent |
| `400` | `"Two-Day Flex package: days must be Monday, Tuesday, Wednesday, or Thursday"` | Package `T` — unrecognised day value |
| `400` | `"Owambe Plus package requires exactly 1 additional day (Monday, Tuesday, Wednesday, or Thursday)"` | Package `C` — wrong number of non-Friday days |
| `400` | `"Owambe Plus package: additional day must be Monday, Tuesday, Wednesday, or Thursday"` | Package `C` — invalid additional day |
| `400` | `"Selected days contain invalid day values"` | A day string doesn't match any known key |

**Other**

| Status | Shape | `message` |
|--------|-------|-----------|
| `409` | C | `"matricNumber already exists"` |
| `429` | D | `"Too many requests, please try again later"` |
| `500` | E | `"Internal server error"` |

---

#### `GET /api/students/:matricNumber`

**App errors — Shape B**

| Status | `message` | Cause |
|--------|-----------|-------|
| `404` | `"Student not found"` | No student with that matric number |

**Other**

| Status | Shape | `message` |
|--------|-------|-----------|
| `429` | D | `"Too many requests, please try again later"` |
| `500` | E | `"Internal server error"` |

---

#### `POST /api/students/select-package`

**Validation errors — Shape A (400)**

| `field` | `message` | Cause |
|---------|-----------|-------|
| `body.matricNumber` | `"Required"` | Field missing |
| `body.matricNumber` | `"String must contain at least 5 character(s)"` | Too short |
| `body.packageCode` | `"Required"` | Field missing |
| `body.packageCode` | `"String must contain exactly 1 character(s)"` | Code is not 1 character |

**App errors — Shape B**

| Status | `message` | Cause |
|--------|-----------|-------|
| `404` | `"Student not found"` | Matric number not registered |
| `404` | `"Package with code X not found"` | `packageCode` doesn't match any package |
| `400` | `"Two-Day Flex package does not include Friday. Please select 2 days from Monday to Thursday"` | Package `T` — Friday included |
| `400` | `"Two-Day Flex package requires exactly 2 days (any days except Friday)"` | Package `T` — wrong day count |
| `400` | `"Two-Day Flex package: days must be Monday, Tuesday, Wednesday, or Thursday"` | Package `T` — invalid day |
| `400` | `"Owambe Plus package requires exactly 1 additional day (Monday, Tuesday, Wednesday, or Thursday)"` | Package `C` — wrong number of non-Friday days |
| `400` | `"Owambe Plus package: additional day must be Monday, Tuesday, Wednesday, or Thursday"` | Package `C` — invalid additional day |
| `400` | `"Selected days contain invalid day values"` | Unrecognised day string |

**Other**

| Status | Shape | `message` |
|--------|-------|-----------|
| `429` | D | `"Too many requests, please try again later"` |
| `500` | E | `"Internal server error"` |

---

#### `POST /api/students/upgrade-package`

**Validation errors — Shape A (400)**

| `field` | `message` | Cause |
|---------|-----------|-------|
| `body.matricNumber` | `"Required"` | Field missing |
| `body.matricNumber` | `"String must contain at least 5 character(s)"` | Too short |
| `body.newPackageCode` | `"Required"` | Field missing |
| `body.newPackageCode` | `"String must contain exactly 1 character(s)"` | Code is not 1 character |

**App errors — Shape B**

| Status | `message` | Cause |
|--------|-----------|-------|
| `404` | `"Student not found"` | Matric number not registered |
| `404` | `"Package with code X not found"` | `newPackageCode` doesn't match any package |
| `404` | `"Package not found"` | Student's current package record is missing |
| `400` | `"Can only upgrade to a higher-priced package. Downgrades are not allowed."` | Target price ≤ current price |

**Other**

| Status | Shape | `message` |
|--------|-------|-----------|
| `429` | D | `"Too many requests, please try again later"` |
| `500` | E | `"Internal server error"` |

---

#### `POST /api/payments/initialize`

> `studentId` in the request body is the student's **matric number**, not a database ID.

**Validation errors — Shape A (400)**

| `field` | `message` | Cause |
|---------|-----------|-------|
| `body.studentId` | `"Required"` | Field missing |
| `body.amount` | `"Required"` | Field missing |
| `body.amount` | `"Expected number, received string"` | Amount sent as a string |
| `body.amount` | `"Number must be greater than 0"` | Amount is 0 or negative |
| `body.email` | `"Required"` | Field missing |
| `body.email` | `"Invalid email"` | Malformed email |

**App errors — Shape B**

| Status | `message` | Cause |
|--------|-----------|-------|
| `404` | `"Student not found"` | Matric number not registered |
| `400` | `"Package already fully paid"` | No outstanding balance |
| `400` | `"Amount must be greater than 0"` | Edge case |
| `400` | `"Failed to initialize payment"` | Flutterwave rejected the request |
| `400` | Varies | Flutterwave-specific error message |

**Other**

| Status | Shape | `message` |
|--------|-------|-----------|
| `429` | D | `"Too many payment requests, please try again later"` |
| `500` | E | `"Internal server error"` |

---

#### `GET /api/payments/verify?reference=...`

**Validation errors — Shape A (400)**

| `field` | `message` | Cause |
|---------|-----------|-------|
| `query.reference` | `"Required"` | `reference` query param missing |

**App errors — Shape B**

| Status | `message` | Cause |
|--------|-----------|-------|
| `404` | `"Payment not found"` | Reference doesn't match any payment |
| `400` | `"Payment verification failed"` | Flutterwave returned non-success status |

**Other**

| Status | Shape | `message` |
|--------|-------|-----------|
| `429` | D | `"Too many payment requests, please try again later"` |
| `500` | E | `"Internal server error"` |

---

### 7.3 Recommended error handling pattern

```js
async function apiCall(url, options) {
  const res = await fetch(url, options);
  const body = await res.json();

  if (!body.success) {
    if (res.status === 429) { showToast(body.message); return; }
    if (res.status === 500) { showToast("Something went wrong. Please try again."); return; }
    if (res.status === 409) { showToast(body.message); return; }

    if (res.status === 400) {
      try {
        const fieldErrors = JSON.parse(body.message);
        fieldErrors.forEach(({ field, message }) => {
          const key = field.replace("body.", "").replace("query.", "");
          setFieldError(key, message);
        });
        return;
      } catch {
        showToast(body.message);
        return;
      }
    }

    if (res.status === 404) { showToast(body.message); return; }
  }

  return body.data;
}
```

---

## 8. Quick Reference

### Required fields per endpoint

| Field            | `/identify`           | `/select-package`     | `/upgrade-package` |
| ---------------- | --------------------- | --------------------- | ------------------ |
| `matricNumber`   | required              | required              | required           |
| `fullName`       | required              | —                     | —                  |
| `gender`         | **required**          | —                     | —                  |
| `packageCode`    | required              | required              | —                  |
| `newPackageCode` | —                     | —                     | required           |
| `selectedDays`   | required for `T` & `C` | required for `T` & `C` | required for `C` |
| `email`          | optional              | —                     | —                  |
| `phone`          | optional              | —                     | —                  |

### `selectedDays` rules

| Package | What to send | Notes |
| ------- | ------------ | ----- |
| `T`     | Array with **exactly 2 items** from Mon–Thu | e.g. `["MONDAY", "WEDNESDAY"]` — Friday must not be included |
| `C`     | Array with **exactly 1 item** (the non-Friday day) | e.g. `["MONDAY"]` — Friday is added automatically by the backend |
| `F`     | Omit or send `[]` | All days are automatic |

---

## 9. Group Package

### 9.1 What it is

3 people register together and pay **₦150,000 total** (not per person). They all get the **Full Experience** package (all 5 days). Payment can be split across multiple transactions — partial payments are supported just like individual packages.

One person fills the form for all 3 members and initiates payment. When the group reaches ₦150,000 total, every member gets their own personalised invite email.

---

### 9.2 User journey

```
1. Group Registration Form
   └─ Collect details for all 3 members
   └─ POST /api/group/register
   └─ Store returned groupId

2. Payment
   └─ Show outstanding balance (₦150,000 initially)
   └─ Let payer enter an amount (up to outstanding)
   └─ POST /api/group/:groupId/pay
   └─ Redirect browser to returned authorization_url (Flutterwave)

3. After Flutterwave redirects back
   └─ GET /api/payments/verify?reference=...   ← same endpoint as individual payments
   └─ Check payment.status
   └─ GET /api/group/:groupId  ← show updated group status

4. Repeat step 2 if group.paymentStatus is still "PARTIALLY_PAID"
```

The verify redirect URL (configured on the backend) must point to your existing `/payment/verify` page — **no new page needed** for verification.

---

### 9.3 Step 1 — Register the group

**`POST /api/group/register`**

Collect one form with 3 member sub-forms. `payerEmail` is the email shown on the Flutterwave checkout (usually the first member's email, but you can let the user type a separate payer email).

**Request**
```json
{
  "payerEmail": "john@example.com",
  "members": [
    {
      "matricNumber": "190408026",
      "fullName": "John Doe",
      "gender": "male",
      "email": "john@example.com",
      "phone": "08012345678"
    },
    {
      "matricNumber": "190408027",
      "fullName": "Jane Smith",
      "gender": "female",
      "email": "jane@example.com",
      "phone": "08087654321"
    },
    {
      "matricNumber": "190408028",
      "fullName": "Bob Jones",
      "gender": "male",
      "email": "bob@example.com",
      "phone": "08098765432"
    }
  ]
}
```

**Success response (200)**
```json
{
  "success": true,
  "message": "Group registered successfully. Use the groupId to initialize payment.",
  "data": {
    "groupId": "6650abc123def456",
    "totalAmount": 150000,
    "outstanding": 150000,
    "members": [
      { "matricNumber": "190408026", "fullName": "John Doe", "email": "john@example.com" },
      { "matricNumber": "190408027", "fullName": "Jane Smith", "email": "jane@example.com" },
      { "matricNumber": "190408028", "fullName": "Bob Jones", "email": "bob@example.com" }
    ]
  }
}
```

**What to do with the response:**
- Save `data.groupId` — you need it for the pay step.
- Save it in `localStorage` or component state so a page refresh doesn't lose it.
- Redirect the user to the group payment page, passing `groupId`.

---

### 9.4 Step 2 — Initialize a payment

**`POST /api/group/:groupId/pay`**

Called every time the group wants to make a payment (first time or subsequent partial payments).

**Request**
```json
{
  "amount": 75000,
  "payerEmail": "john@example.com"
}
```

- `amount` — how much they want to pay this session. Must be > 0 and ≤ outstanding.
- `payerEmail` — whose name/email appears on the Flutterwave payment form. Typically the first member's email, or whoever is physically paying.

**Success response (200)**
```json
{
  "success": true,
  "message": "Group payment initialized successfully",
  "data": {
    "authorization_url": "https://checkout.flutterwave.com/v3/hosted/pay/abc123",
    "reference": "FYW-1716900000000-A1B2C3D4",
    "amount": 75000,
    "outstanding": 75000
  }
}
```

**What to do with the response:**
```js
window.location.href = data.authorization_url;
// Flutterwave handles payment, then redirects to your FLUTTERWAVE_REDIRECT_URL
// with ?reference=FYW-... appended as a query param
```

---

### 9.5 Step 3 — Verify after Flutterwave redirects

After Flutterwave redirects back to your site (same URL as individual payments), call:

**`GET /api/payments/verify?reference=FYW-1716900000000-A1B2C3D4`**

This is the **same existing endpoint** — no change needed on the frontend for this step.

**Response (200)**
```json
{
  "success": true,
  "data": {
    "status": "success",
    "amount": 75000,
    ...
  }
}
```

After verifying, fetch the group status to show the user the updated progress:

**`GET /api/group/:groupId`**

```json
{
  "success": true,
  "data": {
    "groupId": "6650abc123def456",
    "paymentStatus": "PARTIALLY_PAID",
    "totalAmount": 150000,
    "totalPaid": 75000,
    "outstanding": 75000,
    "payerEmail": "john@example.com",
    "members": [
      {
        "matricNumber": "190408026",
        "fullName": "John Doe",
        "email": "john@example.com",
        "paymentStatus": "PARTIALLY_PAID",
        "hasInvite": false,
        "inviteUrl": null
      },
      ...
    ],
    "createdAt": "2024-05-28T10:00:00.000Z"
  }
}
```

**`paymentStatus` values:**
| Value | Meaning |
|---|---|
| `"NOT_PAID"` | No payment made yet |
| `"PARTIALLY_PAID"` | Some payment made, still outstanding |
| `"FULLY_PAID"` | ₦150,000 reached — all invites generated and emailed |

When `paymentStatus === "FULLY_PAID"`, show each member's `inviteUrl` download link.

---

### 9.6 Suggested UI flow

#### Page: `/group/register`

```
Group Package Registration
──────────────────────────
₦150,000 for 3 people • Full Experience • All 5 days

Member 1 (Payer)          Member 2                  Member 3
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Matric Number   │       │ Matric Number   │       │ Matric Number   │
│ Full Name       │       │ Full Name       │       │ Full Name       │
│ Gender          │       │ Gender          │       │ Gender          │
│ Email           │       │ Email           │       │ Email           │
│ Phone           │       │ Phone           │       │ Phone           │
└─────────────────┘       └─────────────────┘       └─────────────────┘

Payer Email: [john@example.com]   ← email for Flutterwave checkout

                    [Register Group →]
```

#### Page: `/group/:groupId/pay` (or `/group/:groupId/dashboard`)

```
Group Payment
─────────────
3 members • Full Experience Package

  Progress
  ████████░░░░░░░░  50% — ₦75,000 paid of ₦150,000

  Outstanding: ₦75,000

  Amount to pay now: [75000      ]
  Payer email:       [john@example.com]

                    [Pay Now →]
```

Show members' invite download buttons when `paymentStatus === "FULLY_PAID"`:

```
✅ Group Fully Paid!

  John Doe        [Download Invite]
  Jane Smith      [Download Invite]
  Bob Jones       [Download Invite]
```

---

### 9.7 Where to persist `groupId`

The `groupId` must survive a Flutterwave redirect (which is a full page navigation).

**Option A — URL param (recommended)**
Pass `groupId` as a query param on the Flutterwave redirect URL:
```
https://yoursite.com/payment/verify?reference=FYW-...&groupId=6650abc123
```
Read it from the URL on the verify page and call `GET /api/group/:groupId` after verifying.

**Option B — localStorage**
```js
localStorage.setItem('pendingGroupId', groupId);
// On verify page:
const groupId = localStorage.getItem('pendingGroupId');
```

---

### 9.8 Error reference

#### `POST /api/group/register`

**Validation errors — Shape A (400)**

| `field` | `message` | Cause |
|---------|-----------|-------|
| `body.members` | `"Array must contain exactly 3 element(s)"` | Not exactly 3 members |
| `body.members[0].matricNumber` | `"Invalid"` | Wrong format |
| `body.members[0].fullName` | `"String must contain at least 2 character(s)"` | Name too short |
| `body.members[0].gender` | `"Invalid enum value. Expected 'male' \| 'female'"` | Wrong gender value |
| `body.members[0].email` | `"Invalid email"` | Malformed email |
| `body.payerEmail` | `"Required"` | Missing payer email |
| `body.payerEmail` | `"Invalid email"` | Malformed payer email |

**App errors — Shape B**

| Status | `message` | Cause |
|--------|-----------|-------|
| `400` | `"A group must have exactly 3 members"` | Wrong member count |
| `400` | `"All 3 members must have different matric numbers"` | Duplicate matric numbers |
| `400` | `"Student 190408026 has already fully paid and cannot be re-registered"` | One member already fully paid individually |

---

#### `POST /api/group/:groupId/pay`

**Validation errors — Shape A (400)**

| `field` | `message` | Cause |
|---------|-----------|-------|
| `body.amount` | `"Required"` | Amount missing |
| `body.amount` | `"Number must be greater than 0"` | Zero or negative |
| `body.payerEmail` | `"Required"` | Email missing |
| `body.payerEmail` | `"Invalid email"` | Malformed email |

**App errors — Shape B**

| Status | `message` | Cause |
|--------|-----------|-------|
| `404` | `"Group registration not found"` | Invalid `groupId` |
| `400` | `"This group has already fully paid"` | Nothing left to pay |
| `400` | `"Amount exceeds outstanding balance of ₦75,000"` | Amount > outstanding |
| `400` | `"FLUTTERWAVE_REDIRECT_URL must be a public URL (localhost is invalid)"` | Backend config issue |
| `400` | Varies | Flutterwave-specific error |
| `429` | `"Too many payment requests, please try again later"` | Rate limited |

---

#### `GET /api/group/:groupId`

**App errors — Shape B**

| Status | `message` | Cause |
|--------|-----------|-------|
| `404` | `"Group registration not found"` | Invalid `groupId` |

---

### 9.9 Full code example

```js
// 1. Register group
async function registerGroup(members, payerEmail) {
  const res = await fetch('/api/group/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ members, payerEmail }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.message);
  return body.data; // { groupId, totalAmount, outstanding, members }
}

// 2. Initialize payment
async function payGroup(groupId, amount, payerEmail) {
  const res = await fetch(`/api/group/${groupId}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, payerEmail }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(body.message);
  // Redirect to Flutterwave
  window.location.href = body.data.authorization_url;
}

// 3. After redirect — verify payment (same as individual)
async function verifyAndFetchGroup(reference, groupId) {
  const verifyRes = await fetch(`/api/payments/verify?reference=${reference}`);
  const verifyBody = await verifyRes.json();
  if (!verifyBody.success) throw new Error(verifyBody.message);

  const groupRes = await fetch(`/api/group/${groupId}`);
  const groupBody = await groupRes.json();
  if (!groupBody.success) throw new Error(groupBody.message);
  return groupBody.data;
}

// Usage on your verify page:
const params = new URLSearchParams(window.location.search);
const reference = params.get('reference');
const groupId   = params.get('groupId'); // if you passed it in the redirect URL

if (reference && groupId) {
  const group = await verifyAndFetchGroup(reference, groupId);
  if (group.paymentStatus === 'FULLY_PAID') {
    showInvites(group.members);
  } else {
    showPayAgainButton(group.groupId, group.outstanding);
  }
}
```
