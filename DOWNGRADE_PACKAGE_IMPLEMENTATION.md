# Downgrade Package — Frontend Implementation Guide

## Overview

Students can now downgrade to a lower-priced package **only when their payment is not yet complete** (i.e. `paymentStatus` is `NOT_PAID` or `PARTIALLY_PAID`). Once a student is `FULLY_PAID`, the option must be hidden or disabled entirely — the backend will reject the request regardless.

---

## 1. When to Show the Downgrade Option

Check `paymentStatus` from the student record (returned by `GET /api/students/:matricNumber` or after any package action):

| `paymentStatus`    | Show downgrade option? |
| ------------------ | ---------------------- |
| `NOT_PAID`         | Yes                    |
| `PARTIALLY_PAID`   | Yes                    |
| `FULLY_PAID`       | **No — hide/disable**  |

Do not rely only on the backend to block this. Guard it in the UI so the option is never presented to a fully-paid student.

---

## 2. Allowed Downgrade Paths

A downgrade is only valid when the target package has a **strictly lower price** than the student's current package.

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

| `packageType`      | Day picker UI                                          |
| ------------------ | ------------------------------------------------------ |
| `CORPORATE_PLUS`   | Monday (disabled/pre-selected) + pick 1 from Tue/Wed/Thu |
| `CORPORATE_OWAMBE` | Monday + Friday (both disabled, no picker)             |
| `FULL`             | All 5 days shown (disabled, no picker)                 |

---

## 4. API Endpoint

### `POST /api/students/downgrade-package`

#### Request body

```json
{
  "matricNumber": "ENG23001",
  "newPackageCode": "T",
  "selectedDays": ["WEDNESDAY"]
}
```

| Field            | Type             | Required                       | Notes                                               |
| ---------------- | ---------------- | ------------------------------ | --------------------------------------------------- |
| `matricNumber`   | `string` (≥ 5)   | Always                         |                                                     |
| `newPackageCode` | `string` (1 char)| Always                         | Must be a lower-priced package code                 |
| `selectedDays`   | `string[]`       | Only for package `T`           | Send `["TUESDAY"]`, `["WEDNESDAY"]`, or `["THURSDAY"]` — do **not** include `"MONDAY"` |

#### `selectedDays` rules

| Target package | What to send                                                               |
| -------------- | -------------------------------------------------------------------------- |
| `T`            | Array with **exactly 1 item**: `"TUESDAY"`, `"WEDNESDAY"`, or `"THURSDAY"` |
| `C`            | Omit or send `[]`                                                          |
| `F`            | N/A — `F` is the highest price, can never be a downgrade target            |

---

#### Success response — `200`

```json
{
  "success": true,
  "message": "Package downgraded successfully",
  "data": {
    "student": { ... },
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

`outstanding` is the remaining amount the student still owes on the new package. If they had partially paid an amount less than or equal to the new package price, that amount is preserved and subtracted. Display it wherever the payment balance is shown.

> **Note on partial payments after downgrade:** If a student had paid ₦25,000 towards a ₦40,000 package and downgrades to a ₦30,000 package, their `totalPaid` stays at ₦25,000 and `outstanding` becomes ₦5,000. Their status is recalculated to `PARTIALLY_PAID`.

---

## 5. Error Reference

#### Validation errors — Shape A (`400`)

| `field`                | `message`                                        | Cause                          |
| ---------------------- | ------------------------------------------------ | ------------------------------ |
| `body.matricNumber`    | `"Required"`                                     | Field missing                  |
| `body.matricNumber`    | `"String must contain at least 5 character(s)"` | Too short                      |
| `body.newPackageCode`  | `"Required"`                                     | Field missing                  |
| `body.newPackageCode`  | `"String must contain exactly 1 character(s)"`  | Code is not exactly 1 character |

> `message` is a **JSON-stringified array** — parse it with `JSON.parse(response.message)` to get field-level errors. See Section 7 of `FRONTEND_IMPLEMENTATION.md` for the full parsing pattern.

---

#### App errors — Shape B (plain string)

| Status | `message`                                                                                     | Cause                                                        |
| ------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `404`  | `"Student not found"`                                                                         | Matric number not registered                                 |
| `404`  | `"Package with code X not found"`                                                             | `newPackageCode` doesn't match any package                   |
| `404`  | `"Package not found"`                                                                         | Student's current package record is missing                  |
| `400`  | `"Cannot downgrade a package after payment is complete."`                                     | Student is `FULLY_PAID` — downgrade is blocked               |
| `400`  | `"Can only downgrade to a lower-priced package. Upgrades are not allowed here."`             | Target package price ≥ current package price                 |
| `400`  | `"Corporate Plus package requires exactly 1 additional day (Tuesday, Wednesday, or Thursday)"` | Target is `T`, `selectedDays` is empty or has more than 1 item |
| `400`  | `"Corporate Plus package: additional day must be Tuesday, Wednesday, or Thursday"`            | Target is `T`, the provided day is Monday or Friday          |
| `400`  | `"Selected days contain invalid day values"`                                                  | Unrecognised day string                                      |

---

#### Other errors

| Status | `message`                                       | Notes                          |
| ------ | ----------------------------------------------- | ------------------------------ |
| `429`  | `"Too many requests, please try again later"`   | Rate limited — show and don't retry |
| `500`  | `"Internal server error"`                       | Show generic fallback message  |

---

## 6. UX Flow

```
Student profile page
  └── Package section
        ├── Current package: Corporate & Owambe (₦40,000)
        ├── Paid: ₦15,000  |  Outstanding: ₦25,000
        │
        ├── [Upgrade Package]     ← shown when cheaper packages exist above
        └── [Downgrade Package]   ← shown only when paymentStatus ≠ FULLY_PAID
              │
              ▼
        Select new (lower) package
              │
              ├── If target is CORPORATE_PLUS → show day picker (1 day: Tue/Wed/Thu)
              └── If target is CORPORATE_OWAMBE / FULL → no picker needed
              │
              ▼
        Confirm downgrade (show a warning: "Any partial payments will be
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

| Field            | `/downgrade-package`          |
| ---------------- | ----------------------------- |
| `matricNumber`   | required                      |
| `newPackageCode` | required                      |
| `selectedDays`   | required only for package `T` |

### Guard conditions (check before showing the button)

- `student.paymentStatus !== "FULLY_PAID"`
- The student has at least one package with a lower price than their current one
