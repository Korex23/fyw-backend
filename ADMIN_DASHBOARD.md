# Admin Dashboard — Frontend Implementation Guide

Base URL for all requests: `/api`  
All protected routes require `Authorization: Bearer <token>` in the request header.

---

## 1. Authentication

### Login
```
POST /api/admin/auth/login
```

**Request body**
```json
{
  "email": "admin@example.com",
  "password": "yourpassword"
}
```

**Response**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<jwt>",
    "admin": {
      "email": "admin@example.com"
    }
  }
}
```

Store the token in `localStorage` or a secure cookie and attach it to every subsequent request:
```
Authorization: Bearer <token>
```

On any `401 Unauthorized` response, clear the token and redirect to `/login`.

---

## 2. Pages & API Calls

### 2.1 Dashboard / Overview

**Endpoint**
```
GET /api/admin/metrics
```

**Response**
```json
{
  "success": true,
  "data": {
    "totalStudents": 120,
    "fullyPaidCount": 80,
    "partiallyPaidCount": 25,
    "notPaidCount": 15,
    "totalRevenue": 4800000,
    "outstandingTotal": 1050000
  }
}
```

**Suggested UI — stat cards**

| Card | Value field |
|------|------------|
| Total Registered | `totalStudents` |
| Fully Paid | `fullyPaidCount` |
| Partially Paid | `partiallyPaidCount` |
| Not Paid | `notPaidCount` |
| Total Revenue | `totalRevenue` (format as ₦) |
| Outstanding | `outstandingTotal` (format as ₦) |

---

### 2.2 Students List

**Endpoint**
```
GET /api/admin/students?page=1&limit=20&status=&packageCode=&search=
```

**Query parameters**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default 1) |
| `limit` | number | Per page (default 20) |
| `status` | string | `NOT_PAID` \| `PARTIALLY_PAID` \| `FULLY_PAID` |
| `packageCode` | string | `T` \| `C` \| `F` |
| `search` | string | Searches full name and matric number |

**Response**
```json
{
  "success": true,
  "data": {
    "students": [
      {
        "_id": "...",
        "fullName": "John Doe",
        "matricNumber": "190410008",
        "gender": "male",
        "email": "john@example.com",
        "phone": "08012345678",
        "department": "...",
        "packageId": {
          "_id": "...",
          "code": "F",
          "name": "Full Experience",
          "packageType": "FULL",
          "price": 60000
        },
        "selectedDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
        "totalPaid": 45000,
        "paymentStatus": "FULLY_PAID",
        "invites": {
          "imageUrl": "https://...",
          "generatedAt": "2025-01-01T00:00:00.000Z"
        },
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 120,
      "pages": 6
    }
  }
}
```

**Suggested UI**
- Table with columns: Name, Matric, Package, Total Paid, Status, Has Invite, Actions
- Filter bar: status dropdown, package dropdown, search input
- Pagination controls using `pagination.page` / `pagination.pages`
- Status badge colours: `FULLY_PAID` → green, `PARTIALLY_PAID` → amber, `NOT_PAID` → red
- "Has Invite" — check `invites?.imageUrl`
- Row click → navigate to student detail page

**Payment status labels**

| Value | Display |
|-------|---------|
| `FULLY_PAID` | Fully Paid |
| `PARTIALLY_PAID` | Partially Paid |
| `NOT_PAID` | Not Paid |

---

### 2.3 Student Detail

**Endpoint**
```
GET /api/admin/students/:id
```

`:id` is the MongoDB `_id` from the students list.

**Response**
```json
{
  "success": true,
  "data": {
    "student": { /* full student object */ },
    "package": {
      "_id": "...",
      "code": "F",
      "name": "Full Experience",
      "packageType": "FULL",
      "price": 60000,
      "benefits": ["..."]
    },
    "payments": [
      {
        "_id": "...",
        "amount": 30000,
        "reference": "FYW-...",
        "status": "success",
        "paidAt": "2025-01-01T00:00:00.000Z",
        "packageIdAtTime": { /* package snapshot at time of payment */ }
      }
    ],
    "totalPaid": 45000,
    "outstanding": 0
  }
}
```

**Note on discounted students:** `outstanding` already accounts for the ₦15,000 discount applied to certain matric numbers on the Full Experience package. Do not recompute it from `package.price` on the frontend — always use `outstanding` from this response.

**Suggested UI**
- Student info card: name, matric, gender, email, phone, department
- Package card: name, selected days, total paid, outstanding, payment status
- Payment history table: amount, reference, status, date
- Action buttons (see sections 2.4 and 2.5)
- If `student.invites.imageUrl` exists, show a preview/download link for the invite image

---

### 2.4 Resend Invite

Sends the existing invite image to the student's email. Only works if an invite has already been generated.

**Endpoint**
```
POST /api/admin/students/:id/resend-invite
```

No request body required.

**Response**
```json
{
  "success": true,
  "message": "Invite resent successfully"
}
```

**UI guidance**
- Show button only when `student.invites?.imageUrl` exists and `student.email` exists
- Disable/show spinner while the request is in flight
- Show success toast on `success: true`
- On error (e.g. no email on file), display the error message from the response

---

### 2.5 Regenerate Invite

Generates a fresh invite image and emails it to the student.

**Endpoint**
```
POST /api/admin/students/:id/regenerate-invite
```

No request body required.

**Response**
```json
{
  "success": true,
  "message": "Invites regenerated and sent successfully",
  "data": {
    "imageUrl": "https://..."
  }
}
```

**UI guidance**
- Available regardless of whether an invite already exists
- After success, update `student.invites.imageUrl` in local state with `data.imageUrl`
- If student has no email the invite is still regenerated — the email step is silently skipped server-side

---

### 2.6 Export CSV

Downloads all students as a CSV file.

**Endpoint**
```
GET /api/admin/export.csv
```

**Response:** raw CSV file with `Content-Disposition: attachment; filename=students-export.csv`

**CSV columns**

| Column | Notes |
|--------|-------|
| Full Name | |
| Matric Number | |
| Email | `N/A` if not provided |
| Phone | `N/A` if not provided |
| Package | Package name |
| Package Price | Base price in Naira |
| Selected Days | Comma-separated day names |
| Total Paid | Amount paid so far |
| Outstanding | Respects discount pricing |
| Payment Status | `NOT_PAID` / `PARTIALLY_PAID` / `FULLY_PAID` |
| Has Invite | `Yes` / `No` |
| Created At | ISO timestamp |

**UI guidance — trigger a file download**
```js
const response = await fetch('/api/admin/export.csv', {
  headers: { Authorization: `Bearer ${token}` }
});
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'students-export.csv';
a.click();
URL.revokeObjectURL(url);
```

---

## 3. Error Handling

All error responses follow this shape:
```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Bad request / validation error — show `message` to user |
| `401` | Unauthenticated — clear token, redirect to login |
| `403` | Forbidden |
| `404` | Resource not found |
| `500` | Server error — show generic "Something went wrong" |

---

## 4. Packages Reference

| Code | Name | Type | Price |
|------|------|------|-------|
| `T` | Two-Day Flex | `CORPORATE_PLUS` | ₦30,000 |
| `C` | Owambe Plus | `CORPORATE_OWAMBE` | ₦40,000 |
| `F` | Full Experience | `FULL` | ₦60,000 (₦45,000 for discounted matrics) |

---

## 5. Suggested Page Structure

```
/login                  → Login page (unauthenticated)
/dashboard              → Overview metrics
/dashboard/students     → Students list with filters
/dashboard/students/:id → Student detail, payment history, invite actions
```

Protect all `/dashboard/*` routes — redirect to `/login` if no valid token is in storage.
