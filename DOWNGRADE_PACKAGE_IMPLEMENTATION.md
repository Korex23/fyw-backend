# Downgrade Package — Frontend Implementation Guide

## Overview

Students can downgrade to a lower-priced package **only when their payment is not yet complete** (i.e. `paymentStatus` is `NOT_PAID` or `PARTIALLY_PAID`). Once a student is `FULLY_PAID`, the option must be hidden or disabled entirely — the backend will reject the request regardless.

---

## 1. When to Show the Downgrade Option

Check `paymentStatus` from the student record (returned by `GET /api/students/:matricNumber` or after any package action):

| `paymentStatus`    | Show downgrade option? |
| ------------------ | ---------------------- |
| `NOT_PAID`         | Yes                    |
| `PARTIALLY_PAID`   | Yes                    |
| `FULLY_PAID`       | **No — hide/disable**  |

Do not rely only on the backend to block this. Guard it in the UI.

---

## 2. Allowed Downgrade Paths

A downgrade is only valid when the target package has a **strictly lower price** than the current package.

```
F (₦60k) → C (₦40k)   ✓
F (₦60k) → T (₦30k)   ✓
C (₦40k) → T (₦30k)   ✓
T (₦30k) → anything   ✗  (already lowest)
C (₦40k) → F (₦60k)   ✗  (higher price — use upgrade instead)
```

Only surface packages cheaper than the student's current one as selectable downgrade targets.

---

## 3. Day Selection UI for Downgrade

After the student picks a target package, show the same day-picker UI used during initial registration — driven by the target package's `packageType`:

| `packageType`      | Day picker UI                                                       |
| ------------------ | ------------------------------------------------------------------- |
| `CORPORATE_PLUS`   | Picker for **2 days** from Mon–Thu (no pre-selection, no Friday)   |
| `CORPORATE_OWAMBE` | Friday (disabled/pre-selected) + picker for **1 day** from Mon–Thu |
| `FULL`             | All 5 days shown (disabled, no picker)                              |

---

## 4. API Endpoint

### `POST /api/students/downgrade-package`

#### Request body

```json
// Downgrading to Corporate Plus (T) — pick any 2 days from Mon–Thu
{
  "matricNumber": "ENG23001",
  "newPackageCode": "T",
  "selectedDays": ["MONDAY", "WEDNESDAY"]
}
```

```json
// Downgrading to Corporate & Owambe (C) — send 1 non-Friday day
{
  "matricNumber": "ENG23001",
  "newPackageCode": "C",
  "selectedDays": ["TUESDAY"]
}
```

| Field            | Type              | Required               | Notes                                                        |
| ---------------- | ----------------- | ---------------------- | ------------------------------------------------------------ |
| `matricNumber`   | `string` (≥ 5)    | Always                 |                                                              |
| `newPackageCode` | `string` (1 char) | Always                 | Must be a lower-priced package code                          |
| `selectedDays`   | `string[]`        | For packages `T` & `C` | See rules below                                              |

#### `selectedDays` rules

| Target package | What to send | Notes |
| -------------- | ------------ | ----- |
| `T`            | Array with **exactly 2 items** from Mon–Thu | e.g. `["MONDAY", "THURSDAY"]` — Friday must not be included |
| `C`            | Array with **exactly 1 item** (the non-Friday day) | e.g. `["WEDNESDAY"]` — Friday is added automatically |
| `F`            | N/A — `F` is the highest price, can never be a downgrade target | |

---

#### Success response — `200`

```json
{
  "success": true,
  "message": "Package downgraded successfully",
  "data": {
    "student": { "..." : "..." },
    "package": {
      "code": "T",
      "name": "Corporate Plus",
      "packageType": "CORPORATE_PLUS",
      "price": 30000,
      "benefits": ["..."]
    },
    "outstanding": 30000
  }
}
```

`outstanding` is the remaining amount owed on the new package. Display it wherever the payment balance is shown.

> **Note on partial payments after downgrade:** If a student had paid ₦25,000 towards a ₦40,000 package and downgrades to a ₦30,000 package, their `totalPaid` stays at ₦25,000 and `outstanding` becomes ₦5,000. Their status is recalculated to `PARTIALLY_PAID`.

---

## 5. Error Reference

#### Validation errors — Shape A (`400`)

| `field`                | `message`                                        | Cause                           |
| ---------------------- | ------------------------------------------------ | ------------------------------- |
| `body.matricNumber`    | `"Required"`                                     | Field missing                   |
| `body.matricNumber`    | `"String must contain at least 5 character(s)"` | Too short                       |
| `body.newPackageCode`  | `"Required"`                                     | Field missing                   |
| `body.newPackageCode`  | `"String must contain exactly 1 character(s)"`  | Code is not exactly 1 character |

> `message` is a **JSON-stringified array** — parse it with `JSON.parse(response.message)`. See Section 7 of `FRONTEND_IMPLEMENTATION.md` for the full parsing pattern.

---

#### App errors — Shape B (plain string)

| Status | `message` | Cause |
| ------ | --------- | ----- |
| `404`  | `"Student not found"` | Matric number not registered |
| `404`  | `"Package with code X not found"` | `newPackageCode` doesn't match any package |
| `404`  | `"Package not found"` | Student's current package record is missing |
| `400`  | `"Cannot downgrade a package after payment is complete."` | Student is `FULLY_PAID` |
| `400`  | `"Can only downgrade to a lower-priced package. Upgrades are not allowed here."` | Target price ≥ current price |
| `400`  | `"Corporate Plus package does not include Friday. Please select 2 days from Monday to Thursday"` | Target is `T`, Friday was included |
| `400`  | `"Corporate Plus package requires exactly 2 days (any days except Friday)"` | Target is `T`, wrong day count |
| `400`  | `"Corporate Plus package: days must be Monday, Tuesday, Wednesday, or Thursday"` | Target is `T`, invalid day value |
| `400`  | `"Corporate & Owambe package requires exactly 1 additional day (Monday, Tuesday, Wednesday, or Thursday)"` | Target is `C`, wrong number of non-Friday days |
| `400`  | `"Corporate & Owambe package: additional day must be Monday, Tuesday, Wednesday, or Thursday"` | Target is `C`, invalid additional day |
| `400`  | `"Selected days contain invalid day values"` | Unrecognised day string |

---

#### Other errors

| Status | `message` | Notes |
| ------ | --------- | ----- |
| `429`  | `"Too many requests, please try again later"` | Rate limited — show and don't retry |
| `500`  | `"Internal server error"` | Show generic fallback message |

---

## 6. UX Flow

```
Student profile page
  └── Package section
        ├── Current package: Corporate & Owambe (₦40,000)
        ├── Paid: ₦15,000  |  Outstanding: ₦25,000
        │
        ├── [Upgrade Package]     ← shown when higher packages exist
        └── [Downgrade Package]   ← shown only when paymentStatus ≠ FULLY_PAID
              │
              ▼
        Select new (lower) package
              │
              ├── If target is CORPORATE_PLUS   → show picker for 2 days from Mon–Thu
              ├── If target is CORPORATE_OWAMBE → Friday pre-selected + pick 1 from Mon–Thu
              └── (FULL can never be a downgrade target)
              │
              ▼
        Confirm downgrade (warn: "Any partial payments will be
        preserved. Your outstanding balance will be recalculated.")
              │
              ▼
        POST /api/students/downgrade-package
              │
              ├── Success → update displayed package + outstanding balance
              └── Error   → display inline or as toast per error shape
```

---

## 7. Quick Reference

### Required fields

| Field            | `/downgrade-package`            |
| ---------------- | ------------------------------- |
| `matricNumber`   | required                        |
| `newPackageCode` | required                        |
| `selectedDays`   | required for packages `T` & `C` |

### Guard conditions (check before showing the button)

- `student.paymentStatus !== "FULLY_PAID"`
- The student has at least one package with a lower price than their current one
