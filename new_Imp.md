# Frontend Update — Owambe Plus Package Change

## What Changed

The **Owambe Plus (C)** package at ₦40,000 now allows **Monday OR Friday** as the anchor day (not Friday-only), plus any **2 other days** — 3 days total.

---

## Updated Package Table

| Code | Name            | Price   | Days |
|------|-----------------|---------|------|
| `T`  | Two-Day Flex    | ₦30,000 | Any **2 days** from Mon–Thu (no Friday) |
| `C`  | Owambe Plus     | ₦40,000 | **Monday or Friday** (anchor, you pick one) + any **2 other days** |
| `F`  | Full Experience | ₦60,000 | All 5 days (no selection needed) |

---

## UI Changes Required — Package `C` (Owambe Plus)

### Before
- Friday shown as pre-selected/disabled chip
- Picker for **1** additional day from Mon–Thu

### Now
- User first picks their anchor: **Monday** (Corporate Day) or **Friday** (Owambe Day)
- Then picks **2 more days** from the remaining 4 weekdays
- User must select exactly **3 days total** — no more, no less

```
Pick your anchor day (1):
  ( ) Monday    (Corporate Day)
  ( ) Friday    (Owambe Day)

Pick 2 more days:
  [ ] <remaining 4 weekdays based on anchor chosen>
```

---

## API — What to Send

### `POST /api/students/identify` and `POST /api/students/select-package`

Send all **3 days** (anchor + 2 others) in `selectedDays`.

```json
{
  "matricNumber": "ENG23002",
  "fullName": "Ada Obi",
  "gender": "female",
  "packageCode": "C",
  "email": "ada@example.com",
  "phone": "08098765432",
  "selectedDays": ["FRIDAY", "TUESDAY", "THURSDAY"]
}
```

Or with Monday as anchor:

```json
{
  "selectedDays": ["MONDAY", "WEDNESDAY", "FRIDAY"]
}
```

### `POST /api/students/upgrade-package` (upgrading to C)

```json
{
  "matricNumber": "ENG23001",
  "newPackageCode": "C",
  "selectedDays": ["MONDAY", "TUESDAY", "THURSDAY"]
}
```

---

## Updated `selectedDays` Rules

| Package | What to send | Notes |
|---------|--------------|-------|
| `T` | Array with **exactly 2 items** from Mon–Thu | Friday must not be included |
| `C` | Array with **exactly 3 items** | Must include exactly one of Monday or Friday; the other 2 can be any remaining weekdays |
| `F` | Omit or send `[]` | All days are automatic |

---

## Updated packageType UI Logic

| `packageType`        | Day picker UI |
|----------------------|---------------|
| `CORPORATE_PLUS`     | Picker for **2 days** from Mon–Thu (no pre-selection, no Friday) |
| `CORPORATE_OWAMBE`   | Anchor selector (Monday or Friday) + picker for **2 more days** from remaining |
| `FULL`               | All 5 days shown (disabled, no picker) |

---

## Updated Error Messages (Package `C`)

| Status | `message` | Cause |
|--------|-----------|-------|
| `400` | `"This package requires exactly 3 days: Monday or Friday as your anchor day, plus any 2 other days"` | Wrong number of days sent |
| `400` | `"This package requires exactly one anchor day: either Monday (Corporate Day) or Friday (Owambe Day)"` | No anchor day, or both Monday and Friday included |
| `400` | `"Selected days contain invalid day values"` | Non-event day value sent |

---

## Validation to Add on Frontend

For package `C`:
- Require user to pick exactly 1 anchor (Monday or Friday)
- Then pick exactly 2 more from the remaining days
- Block submission if total is not exactly 3
- Show inline error: `"Please select your anchor day (Monday or Friday) and exactly 2 other days"`
