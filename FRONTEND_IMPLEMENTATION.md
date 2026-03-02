# Frontend Implementation Guide

## 1. Package Restructure

The package lineup has been updated. The old single "Two-Day" package (any 2 days, ₦30k) has been replaced with two distinct packages:

| Code | Name               | Price   | Days                                                   |
| ---- | ------------------ | ------- | ------------------------------------------------------ |
| `T`  | Corporate Plus     | ₦30,000 | Monday (fixed) + **1 day you pick** (Tue, Wed, or Thu) |
| `C`  | Corporate & Owambe | ₦40,000 | Monday + Friday (**both fixed, no selection**)         |
| `F`  | Full Experience    | ₦60,000 | All 5 days (**no selection needed**)                   |

---

## 2. Gender Field — Now Required

`gender` is now a **required field** on the identify/create student endpoint. The form must collect it before submission and the field must always be included in the request body.

**Accepted values:** `"male"` or `"female"` (lowercase, exactly as written).

### Form UI

Add a gender selector to the registration/identification form. This must be answered before the form can be submitted — treat it the same as `fullName` and `matricNumber`.

Recommended UI: two mutually exclusive radio buttons or a toggle.

```
Gender *
  ○ Male   ○ Female
```

### Validation

- Field is required — show an inline error if the user tries to submit without selecting one.
- No default selection — force a deliberate choice.

---

## 3. Package Selection UI Changes

### Package `T` — Corporate Plus (₦30,000)

**Old behaviour:** Show a day picker where the user chose any 2 days from Mon–Fri.

**New behaviour:**

- Monday is **always included** — show it as a pre-selected, disabled chip/badge.
- Show a picker for **1 additional day** with only these options:
  - Tuesday (Denim Day)
  - Wednesday (Costume Day)
  - Thursday (Jersey Day)
- Friday must **not** appear as an option.
- The user must pick exactly **1** day.

---

### Package `C` — Corporate & Owambe (₦40,000)

**New package — no day selection UI needed.**

- Show both days as pre-selected, non-interactive: **Monday (Corporate Day)** and **Friday (Cultural Day/Owambe)**.
- The user cannot change the days.

---

### Package `F` — Full Experience (₦60,000)

No change. Show all 5 days as included. No picker.

---

## 4. API Endpoints

### POST `/api/students/identify`

`gender` is required on this endpoint alongside `matricNumber`, `fullName`, and `packageCode`.

```json
// Corporate Plus (T)
{
  "matricNumber": "ENG23001",
  "fullName": "Jane Doe",
  "gender": "female",
  "packageCode": "T",
  "email": "jane@example.com",
  "phone": "08012345678",
  "selectedDays": ["TUESDAY"]
}
```

```json
// Corporate & Owambe (C) — no selectedDays needed
{
  "matricNumber": "ENG23002",
  "fullName": "Ada Obi",
  "gender": "female",
  "packageCode": "C",
  "email": "ada@example.com",
  "phone": "08098765432"
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

Gender is **not** required here — this endpoint only updates the package/day selection for an already-identified student.

```json
// Switching to Corporate Plus, picking Wednesday as extra day
{
  "matricNumber": "ENG23001",
  "packageCode": "T",
  "selectedDays": ["WEDNESDAY"]
}

// Switching to Corporate & Owambe — no selectedDays
{
  "matricNumber": "ENG23001",
  "packageCode": "C"
}
```

---

### POST `/api/students/upgrade-package`

Gender is **not** required here either.

```json
// T → C
{
  "matricNumber": "ENG23001",
  "newPackageCode": "C"
}

// T → F  or  C → F
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

Use `packageType` from the packages API to drive UI logic — don't hardcode package behaviour by `code`.

| `packageType`      | Day picker UI                                          |
| ------------------ | ------------------------------------------------------ |
| `CORPORATE_PLUS`   | Show Monday (disabled) + single picker for Tue/Wed/Thu |
| `CORPORATE_OWAMBE` | Show Monday + Friday (both disabled, no picker)        |
| `FULL`             | Show all 5 days (disabled, no picker)                  |

Full response shape:

```json
[
  {
    "code": "T",
    "name": "Corporate Plus",
    "packageType": "CORPORATE_PLUS",
    "price": 30000,
    "benefits": ["..."]
  },
  {
    "code": "C",
    "name": "Corporate & Owambe",
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

Every error response has `success: false`. However the `message` field means **different things** depending on the source of the error — you must handle both.

---

#### Shape A — Validation error (Zod, field-level)

Triggered when required fields are missing, wrong type, wrong format, or wrong length. HTTP status is always `400`.

```json
{
  "success": false,
  "message": "[{\"field\":\"body.gender\",\"message\":\"Required\"},{\"field\":\"body.matricNumber\",\"message\":\"String must contain at least 5 character(s)\"}]"
}
```

> `message` is a **JSON-stringified array**. You must `JSON.parse(response.message)` to get the field-level errors.

```js
// Parsing pattern
if (response.success === false) {
  try {
    const fieldErrors = JSON.parse(response.message);
    // fieldErrors = [{ field: "body.gender", message: "Required" }, ...]
    fieldErrors.forEach(({ field, message }) => {
      const key = field.replace("body.", ""); // "gender", "matricNumber", etc.
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

Triggered by business logic, missing records, or server failures. HTTP status varies.

```json
{
  "success": false,
  "message": "Student not found"
}
```

`message` is always a plain, human-readable string here — display it directly.

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

Payment endpoints have a stricter limit. Message will be:
`"Too many payment requests, please try again later"`

---

#### Shape E — Server error (500)

```json
{
  "success": false,
  "message": "Internal server error"
}
```

Show a generic fallback message. Do not retry automatically.

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
| `400` | `"Corporate Plus package requires exactly 1 additional day (Tuesday, Wednesday, or Thursday)"` | Package `T` selected, `selectedDays` is empty or has more than 1 item |
| `400` | `"Corporate Plus package: additional day must be Tuesday, Wednesday, or Thursday"` | Package `T` selected, the provided day is Monday or Friday |
| `400` | `"Selected days contain invalid day values"` | A day string doesn't match any known day key |

**Other**

| Status | Shape | `message` |
|--------|-------|-----------|
| `409` | C | `"matricNumber already exists"` — race condition, very rare |
| `429` | D | `"Too many requests, please try again later"` |
| `500` | E | `"Internal server error"` |

---

#### `GET /api/students/:matricNumber`

No body validation. The matric number comes from the URL.

**App errors — Shape B**

| Status | `message` | Cause |
|--------|-----------|-------|
| `404` | `"Student not found"` | No student exists with that matric number |

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
| `400` | `"Corporate Plus package requires exactly 1 additional day (Tuesday, Wednesday, or Thursday)"` | Package `T`, wrong number of days |
| `400` | `"Corporate Plus package: additional day must be Tuesday, Wednesday, or Thursday"` | Package `T`, day is Mon or Fri |
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
| `400` | `"Can only upgrade to a higher-priced package. Downgrades are not allowed."` | Target package price ≤ current package price |

**Other**

| Status | Shape | `message` |
|--------|-------|-----------|
| `429` | D | `"Too many requests, please try again later"` |
| `500` | E | `"Internal server error"` |

---

#### `POST /api/payments/initialize`

> Note: `studentId` in this request body is the student's **matric number**, not a database ID.

**Validation errors — Shape A (400)**

| `field` | `message` | Cause |
|---------|-----------|-------|
| `body.studentId` | `"Required"` | Field missing |
| `body.amount` | `"Required"` | Field missing |
| `body.amount` | `"Expected number, received string"` | Amount sent as a string, not a number |
| `body.amount` | `"Number must be greater than 0"` | Amount is 0 or negative |
| `body.email` | `"Required"` | Field missing |
| `body.email` | `"Invalid email"` | Malformed email |

**App errors — Shape B**

| Status | `message` | Cause |
|--------|-----------|-------|
| `404` | `"Student not found"` | Matric number not registered |
| `400` | `"Package already fully paid"` | Student has no outstanding balance |
| `400` | `"Amount must be greater than 0"` | Edge case if amount bypasses Zod |
| `400` | `"Failed to initialize payment"` | Flutterwave API rejected the request |
| `400` | Varies | Flutterwave returned a specific error message |

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
| `query.reference` | `"Required"` | `reference` query param missing from URL |

**App errors — Shape B**

| Status | `message` | Cause |
|--------|-----------|-------|
| `404` | `"Payment not found"` | Reference doesn't match any payment record |
| `400` | `"Payment verification failed"` | Flutterwave returned a non-success status |

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
    // Rate limited
    if (res.status === 429) {
      showToast(body.message);
      return;
    }

    // Server error
    if (res.status === 500) {
      showToast("Something went wrong. Please try again.");
      return;
    }

    // Duplicate record
    if (res.status === 409) {
      showToast(body.message); // e.g. "matricNumber already exists"
      return;
    }

    // Validation error — message is a JSON string
    if (res.status === 400) {
      try {
        const fieldErrors = JSON.parse(body.message);
        fieldErrors.forEach(({ field, message }) => {
          const key = field.replace("body.", "").replace("query.", "");
          setFieldError(key, message); // show inline under the field
        });
        return;
      } catch {
        // Not a field-level error — show as a toast/banner
        showToast(body.message);
        return;
      }
    }

    // 404 — not found
    if (res.status === 404) {
      showToast(body.message);
      return;
    }
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
| `selectedDays`   | required for `T` only | required for `T` only | —                  |
| `email`          | optional              | —                     | —                  |
| `phone`          | optional              | —                     | —                  |

### `selectedDays` rules

| Package | What to send                                                               |
| ------- | -------------------------------------------------------------------------- |
| `T`     | Array with **exactly 1 item**: `"TUESDAY"`, `"WEDNESDAY"`, or `"THURSDAY"` |
| `C`     | Omit or send `[]`                                                          |
| `F`     | Omit or send `[]`                                                          |

> For package `T`, do **not** include `"MONDAY"` — the backend adds it automatically.
