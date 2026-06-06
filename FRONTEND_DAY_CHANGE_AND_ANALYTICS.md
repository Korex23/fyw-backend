# Frontend Implementation — Day Change, Day Swap & New Analytics

This document covers everything the frontend needs for the recent backend changes:

1. **Change Selected Days** — a new endpoint letting a student re-pick their event days within their package's scope (allowed whether or not they've paid).
2. **Day Swap (Wed ↔ Thu)** — a one-off backend migration that swapped some students' days. The frontend only needs to be aware of the new theme labels.
3. **New Admin Analytics fields** — projected revenue from people who've started paying, and a per-day attendance breakdown.

All endpoints are under the base path `/api`. Amounts are in **naira** (whole units, e.g. `30000` = ₦30,000).

---

## 0. Event Days & Theme Labels (current state)

The themes for Wednesday and Thursday were swapped. Use these labels everywhere days are shown:

| Key | Label |
|-----|-------|
| `MONDAY` | Monday - Corporate Day |
| `TUESDAY` | Tuesday - Denim Day |
| `WEDNESDAY` | **Wednesday - Costume Day** |
| `THURSDAY` | **Thursday - Jersey Day** |
| `FRIDAY` | Friday - Cultural Day/Owambe |

> ⚠️ Note the swap: **Costume Day is now Wednesday**, **Jersey Day is now Thursday**. If you hardcoded these labels anywhere, update them.

---

## 1. Change Selected Days

Let a student change *which* days they attend **without changing their package**. The new selection must obey the same day rules as the package they're paying for. Works for both fully-paid and not-yet-paid students. If the student already has a generated invite, the backend regenerates it automatically to match the new days.

### Endpoint

```
POST /api/students/change-days
```

No auth required (same as `select-package` / `upgrade-package`).

### Request body

```json
{
  "matricNumber": "190408026",
  "selectedDays": ["MONDAY", "THURSDAY"]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `matricNumber` | string | Must match `1904xxxxx` or `2104xxxxx` (9 digits, no letters). |
| `selectedDays` | string[] | At least 1 item. Day keys (uppercase). Must satisfy the package rules below. |

### Day rules per package

The picker you show must match the student's **current** package:

| Package | Code | Rule for `selectedDays` |
|---------|------|--------------------------|
| Two-Day Flex | `T` | **Exactly 2** days from `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`. **No Friday.** |
| Owambe Plus | `C` | **Exactly 3** days: exactly **one anchor** (`MONDAY` *or* `FRIDAY`) **plus any 2** other days. |
| Full Experience | `F` | ❌ Not allowed — all 5 days are already included, nothing to change. Hide the "change days" UI for this package. |

> Get the student's current package from `GET /api/students/:matricNumber` (`data.package.code` / `data.package.packageType`) before rendering the picker.

### Success response — `200`

```json
{
  "success": true,
  "message": "Selected days updated successfully",
  "data": {
    "student": { "...": "full student object, incl. updated selectedDays and (if applicable) regenerated invites.imageUrl" },
    "package": { "code": "T", "name": "Two-Day Flex", "packageType": "CORPORATE_PLUS", "price": 30000, "benefits": ["..."] }
  }
}
```

If the student was fully paid, `data.student.invites.imageUrl` is the **new** invite — refresh any invite preview/download link you're showing.

### Error responses

All errors use this shape (HTTP 4xx):

```json
{ "success": false, "message": "..." }
```

Messages you should handle (display directly as a toast/inline error):

| Message | Cause |
|---------|-------|
| `The Full Experience package already includes every day — there are no days to change.` | Tried to change days on a `F` package. |
| `Group members cannot change their days individually.` | Student belongs to a group registration. |
| `This package requires exactly 3 days: Monday or Friday as your anchor day, plus any 2 other days` | Owambe Plus (`C`) — wrong number of days. |
| `This package requires exactly one anchor day: either Monday (Corporate Day) or Friday (Owambe Day)` | Owambe Plus (`C`) — zero or two anchors. |
| `Corporate Plus package does not include Friday. Please select 2 days from Monday to Thursday` | Two-Day Flex (`T`) — Friday was included. |
| `Corporate Plus package requires exactly 2 days (any days except Friday)` | Two-Day Flex (`T`) — not exactly 2 days. |
| `Corporate Plus package: days must be Monday, Tuesday, Wednesday, or Thursday` | Two-Day Flex (`T`) — invalid day value. |
| `Selected days contain invalid day values` | Day key not in the allowed set. |
| `Student not found` | Unknown matric number. |

Schema-level validation failures (e.g. malformed `matricNumber`, empty `selectedDays`) come back as a `message` containing a JSON-stringified array of `{ field, message }`. Wrap your parse in a try/catch and fall back to a generic "Please check your input" message.

### Example (fetch)

```ts
async function changeDays(matricNumber: string, selectedDays: string[]) {
  const res = await fetch("/api/students/change-days", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matricNumber, selectedDays }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data; // { student, package }
}
```

### UI checklist

- [ ] Only show "Change days" when `package.code !== "F"` and the student is **not** part of a group.
- [ ] Render the day picker matching the package rule above (count + Friday/anchor constraints), client-side, before submitting.
- [ ] Pre-select the student's current `selectedDays`.
- [ ] On success, update local state with `data.student.selectedDays`; if `data.student.invites?.imageUrl` is present, refresh the invite preview.
- [ ] Surface the backend error `message` on failure.

---

## 2. Day Swap (Wed ↔ Thu) — awareness only

A one-off backend script swapped event days for **fully-paid** students on the **Two-Day Flex (`T`)** and **Owambe Plus (`C`)** packages, to follow the theme move:

- Picked **Wednesday** (old Jersey) → moved to **Thursday** (Jersey).
- Picked **Thursday** (old Costume) → moved to **Wednesday** (Costume).

Those students were emailed and their invites regenerated. **No frontend action is required** — just be aware that some students' `selectedDays` and `invites.imageUrl` changed server-side, and the theme labels are as listed in section 0. Always render `selectedDays` from the API rather than from any cached/old value.

---

## 3. Admin Analytics — new fields

```
GET /api/admin/metrics
Authorization: Bearer <admin JWT>
```

The response gains three fields (existing fields unchanged):

```json
{
  "success": true,
  "data": {
    "totalStudents": 320,
    "fullyPaidCount": 180,
    "partiallyPaidCount": 60,
    "notPaidCount": 80,
    "totalRevenue": 7200000,
    "outstandingTotal": 4500000,

    "startedPayersOutstanding": 1800000,
    "projectedRevenueIfStartedComplete": 9000000,
    "dayBreakdown": [
      { "day": "MONDAY",    "label": "Monday - Corporate Day",     "startedCount": 120, "fullyPaidCount": 90 },
      { "day": "TUESDAY",   "label": "Tuesday - Denim Day",        "startedCount": 64,  "fullyPaidCount": 40 },
      { "day": "WEDNESDAY", "label": "Wednesday - Costume Day",    "startedCount": 88,  "fullyPaidCount": 61 },
      { "day": "THURSDAY",  "label": "Thursday - Jersey Day",      "startedCount": 95,  "fullyPaidCount": 70 },
      { "day": "FRIDAY",    "label": "Friday - Cultural Day/Owambe","startedCount": 150, "fullyPaidCount": 130 }
    ],

    "groups": {
      "totalGroups": 12,
      "fullyPaidGroups": 7,
      "pendingGroups": 5,
      "groupRevenue": 2520000
    }
  }
}
```

### What the new fields mean

| Field | Meaning |
|-------|---------|
| `outstandingTotal` *(existing)* | Total still owed by **everyone** — people who've started paying **and** those who haven't started at all. |
| `startedPayersOutstanding` *(new)* | Total still owed **only** by people who have already started paying (partially-paid individuals + partially-paid groups). i.e. *"how much more will come in if everyone who started clears their balance."* |
| `projectedRevenueIfStartedComplete` *(new)* | `totalRevenue + startedPayersOutstanding` — the projected grand total once started-payers finish. |
| `dayBreakdown` *(new)* | Per event day, how many paying students have access. `startedCount` = anyone who's paid something (partial + full); `fullyPaidCount` = fully paid only. Counts respect package type (Full Experience counts toward all 5 days; Owambe Plus counts its anchor day). |

### Suggested presentation

- Keep your existing "Outstanding" tile (`outstandingTotal`).
- Add a tile: **"Expected from active payers"** → `startedPayersOutstanding`, optionally with subtitle "Projected total: ₦`projectedRevenueIfStartedComplete`".
- Render `dayBreakdown` as a bar chart or table — one row/bar per day, showing `fullyPaidCount` and `startedCount`. Use the provided `label` for axis/row titles.

### Example (fetch + render)

```ts
type DayBreakdownEntry = {
  day: string;
  label: string;
  startedCount: number;
  fullyPaidCount: number;
};

type Metrics = {
  totalStudents: number;
  totalRevenue: number;
  fullyPaidCount: number;
  partiallyPaidCount: number;
  notPaidCount: number;
  outstandingTotal: number;
  startedPayersOutstanding: number;
  projectedRevenueIfStartedComplete: number;
  dayBreakdown: DayBreakdownEntry[];
  groups: {
    totalGroups: number;
    fullyPaidGroups: number;
    pendingGroups: number;
    groupRevenue: number;
  };
};

async function getMetrics(token: string): Promise<Metrics> {
  const res = await fetch("/api/admin/metrics", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

const naira = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
```

### Admin checklist

- [ ] Add the "Expected from active payers" metric (`startedPayersOutstanding`), distinct from the existing total-outstanding tile.
- [ ] Optionally show `projectedRevenueIfStartedComplete` as the projected grand total.
- [ ] Add a per-day chart/table from `dayBreakdown` (use `fullyPaidCount` and/or `startedCount`).
- [ ] Format all amounts as naira.
