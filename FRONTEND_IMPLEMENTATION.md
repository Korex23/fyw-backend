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
