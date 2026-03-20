# New Package Rules — What Changed & Frontend Implementation

## What Changed

### ₦30,000 — Corporate Plus (`T`)

| | Before | After |
|---|---|---|
| Days | Monday (fixed) + 1 day from Tue/Wed/Thu | **Any 2 days from Mon–Thu (no Friday)** |
| Monday pre-selected? | Yes — always included | No — student picks both days freely |
| Friday available? | No | No |

### ₦40,000 — Corporate & Owambe (`C`)

| | Before | After |
|---|---|---|
| Days | Monday + Friday (both fixed, no selection) | **Friday (fixed) + 1 day student picks from Mon–Thu** |
| Selection needed? | No | Yes — student picks 1 additional day |

### ₦60,000 — Full Experience (`F`)

No change. All 5 days (Mon–Fri), no selection needed.

---

## What the Frontend Needs to Do

### Package `T` — Corporate Plus (₦30,000)

**Day picker UI:**
- Show a multi-select picker with **4 options only**: Monday, Tuesday, Wednesday, Thursday
- Friday must **not** appear
- No pre-selected days — both slots are free choices
- User must pick **exactly 2 days** before they can proceed

**`selectedDays` to send:**
```json
"selectedDays": ["MONDAY", "WEDNESDAY"]
```
Any 2 values from: `"MONDAY"`, `"TUESDAY"`, `"WEDNESDAY"`, `"THURSDAY"`

---

### Package `C` — Corporate & Owambe (₦40,000)

**Day picker UI:**
- Show **Friday** as a pre-selected, disabled chip (always included)
- Show a single-select picker with **4 options**: Monday, Tuesday, Wednesday, Thursday
- User must pick **exactly 1** additional day

**`selectedDays` to send:**
```json
"selectedDays": ["MONDAY"]
```
Send only the **non-Friday day**. The backend adds Friday automatically.

---

### Package `F` — Full Experience (₦60,000)

No UI change. Show all 5 days as included. Omit `selectedDays` or send `[]`.

---

## Updated `selectedDays` Rules (All Endpoints)

Applies to `/identify`, `/select-package`, `/upgrade-package`, and `/downgrade-package`.

| Package | Send | Example |
| ------- | ---- | ------- |
| `T` | **2 items**, any from Mon–Thu | `["TUESDAY", "THURSDAY"]` |
| `C` | **1 item**, the non-Friday day | `["WEDNESDAY"]` |
| `F` | Omit or `[]` | — |

---

## New Error Messages to Handle

These are new backend error strings that may now come back. Add them to your error handling alongside existing ones.

### Package `T` errors
| `message` | Cause |
|-----------|-------|
| `"Corporate Plus package does not include Friday. Please select 2 days from Monday to Thursday"` | Friday was included in `selectedDays` |
| `"Corporate Plus package requires exactly 2 days (any days except Friday)"` | Not exactly 2 days sent |
| `"Corporate Plus package: days must be Monday, Tuesday, Wednesday, or Thursday"` | Invalid day value |

### Package `C` errors
| `message` | Cause |
|-----------|-------|
| `"Corporate & Owambe package requires exactly 1 additional day (Monday, Tuesday, Wednesday, or Thursday)"` | Not exactly 1 non-Friday day sent |
| `"Corporate & Owambe package: additional day must be Monday, Tuesday, Wednesday, or Thursday"` | Invalid additional day |

> These are Shape B errors (plain string). Display them directly as a toast or inline message.

---

## Summary Checklist

- [ ] Package `T` day picker: remove Monday pre-selection, allow any 2 from Mon–Thu, hide Friday
- [ ] Package `C` day picker: add Friday as fixed/disabled, add single-select for 1 day from Mon–Thu
- [ ] Update `selectedDays` payload for `T` — now sends 2 items instead of 1
- [ ] Update `selectedDays` payload for `C` — now sends 1 item (was empty/omitted before)
- [ ] Add handling for the new error messages listed above
- [ ] Apply changes to all flows that use day selection: registration, select-package, upgrade, downgrade
