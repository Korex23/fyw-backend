# Frontend Implementation Guide — Package Restructure

## What Changed

The package lineup has been updated. The old single "Two-Day" package (any 2 days, ₦30k) has been replaced with two distinct packages:

| Code | Name | Price | Days |
|------|------|-------|------|
| `T` | Corporate Plus | ₦30,000 | Monday (fixed) + **1 day you pick** (Tue, Wed, or Thu) |
| `C` | Corporate & Owambe | ₦40,000 | Monday + Friday (**both fixed, no selection**) |
| `F` | Full Experience | ₦60,000 | All 5 days (**no selection needed**) |

---

## Package Selection UI Changes

### Package `T` — Corporate Plus (₦30,000)

**Old behaviour:** Show a day picker where the user chose any 2 days from Mon–Fri.

**New behaviour:**
- Monday is **always included** (show it as a pre-selected, disabled chip/badge).
- Show a picker for **1 additional day** with only these options:
  - Tuesday (Denim Day)
  - Wednesday (Costume Day)
  - Thursday (Jersey Day)
- Friday must **not** appear as an option.
- The user must pick exactly **1** day.

**What to send in the API request:**
```json
{
  "packageCode": "T",
  "selectedDays": ["TUESDAY"]   // just the extra day — Monday is added by the backend
}
```

> Send only the 1 chosen day. Do NOT include MONDAY in `selectedDays` — the backend adds it automatically.

---

### Package `C` — Corporate & Owambe (₦40,000)

**New package — no day selection UI needed.**

- Show both days as pre-selected, non-interactive: **Monday (Corporate Day)** and **Friday (Cultural Day/Owambe)**.
- The user cannot change the days.

**What to send in the API request:**
```json
{
  "packageCode": "C"
  // no selectedDays field needed
}
```

---

### Package `F` — Full Experience (₦60,000)

No change. Show all 5 days as included. No picker.

```json
{
  "packageCode": "F"
  // no selectedDays field needed
}
```

---

## API Endpoints Affected

All three endpoints that accept `packageCode` + `selectedDays` follow these same rules:

### POST `/api/students/identify`
```json
// Corporate Plus
{
  "matricNumber": "ENG23001",
  "fullName": "Jane Doe",
  "gender": "female",
  "packageCode": "T",
  "selectedDays": ["THURSDAY"]
}

// Corporate & Owambe
{
  "matricNumber": "ENG23002",
  "fullName": "Ada Obi",
  "gender": "female",
  "packageCode": "C"
}
```

### POST `/api/students/select-package`
```json
// Corporate Plus — changing extra day to Wednesday
{
  "matricNumber": "ENG23001",
  "packageCode": "T",
  "selectedDays": ["WEDNESDAY"]
}
```

### POST `/api/students/upgrade-package`
```json
// Upgrading from T to C
{
  "matricNumber": "ENG23001",
  "newPackageCode": "C"
  // no selectedDays needed for C
}

// Upgrading from T to F
{
  "matricNumber": "ENG23001",
  "newPackageCode": "F"
  // no selectedDays needed for F
}
```

---

## Upgrade Paths

Upgrades are only allowed to a **higher-priced** package:

```
T (₦30k) → C (₦40k)   ✓
T (₦30k) → F (₦60k)   ✓
C (₦40k) → F (₦60k)   ✓
C (₦40k) → T (₦30k)   ✗  (lower price — not allowed)
F (₦60k) → anything   ✗  (already highest)
```

Previously paid amounts are **preserved** across upgrades. Show the outstanding balance clearly.

---

## GET `/api/students/packages` Response

The packages endpoint now returns 3 packages. Use `packageType` to drive UI logic:

| `packageType` | UI Behaviour |
|---|---|
| `CORPORATE_PLUS` | Show Monday (disabled) + picker for 1 day (Tue/Wed/Thu only) |
| `CORPORATE_OWAMBE` | Show Monday + Friday (both disabled, no picker) |
| `FULL` | Show all 5 days (disabled, no picker) |

Example response shape:
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

## Validation Errors to Handle

If the frontend sends wrong days for package `T`, the API returns `400`:

```json
{ "success": false, "message": "Corporate Plus package requires exactly 1 additional day (Tuesday, Wednesday, or Thursday)" }
{ "success": false, "message": "Corporate Plus package: additional day must be Tuesday, Wednesday, or Thursday" }
```

Make sure to surface these errors in the UI when they occur.

---

## Summary of `selectedDays` Rules

| Package | `selectedDays` to send |
|---------|------------------------|
| `T` | Array with **1 item**: `"TUESDAY"`, `"WEDNESDAY"`, or `"THURSDAY"` |
| `C` | Omit entirely (or send `[]`) |
| `F` | Omit entirely (or send `[]`) |
