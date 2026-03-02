# Final Year Week Backend API

Backend API for Final Year Week registration, package selection, payments, invite generation, and admin management.

## Features

- Package management with 3 options:
  - `T` (Corporate Plus) - `N30,000`
  - `C` (Corporate & Owambe) - `N40,000`
  - `F` (Full Experience) - `N60,000`
- Student identify/create by matric number
- Day selection rules enforced per package type
- Flutterwave v3 payment initialization and verification
- Upgrade flow with payment preservation (`T -> C -> F` or `T -> F`)
- Automatic invite generation (image) with selected days included
- Webhook processing with signature check and idempotency
- Admin endpoints for metrics, student management, invite resend/regeneration, CSV export

## Event Days

Valid day keys:

- `MONDAY` - Corporate Day
- `TUESDAY` - Denim Day
- `WEDNESDAY` - Costume Day
- `THURSDAY` - Jersey Day
- `FRIDAY` - Cultural Day/Owambe

Rules:

- Package `T` (Corporate Plus): Monday is always included. Student selects exactly **1** additional day from Tuesday, Wednesday, or Thursday. Stored as `["MONDAY", "<chosen_day>"]`.
- Package `C` (Corporate & Owambe): Fixed days — **Monday + Friday**. No day selection required.
- Package `F` (Full Experience): All 5 days granted automatically. No day selection required.

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure `.env`

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/final-year-week
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

ADMIN_EMAIL=admin@finalyearweek.com
ADMIN_PASSWORD=change-this-password

FLUTTERWAVE_SECRET_KEY=your_flw_secret_key
FLUTTERWAVE_PUBLIC_KEY=your_flw_public_key
FLUTTERWAVE_ENCRYPTION_KEY=your_flw_encryption_key_optional
FLUTTERWAVE_REDIRECT_URL=https://your-public-frontend-domain/payment/verify
FLUTTERWAVE_WEBHOOK_SECRET_HASH=your_webhook_secret_hash

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASSWORD=...
EMAIL_FROM=Final Year Week <noreply@finalyearweek.com>

FRONTEND_URL=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10
```

3. Seed packages

```bash
npm run seed
```

4. Run app

```bash
npm run dev
```

Base URL:

```text
http://localhost:5000/api
```

## Package Seeded by Default

- `T` - Corporate Plus - `N30,000` (Monday + 1 of Tue/Wed/Thu)
- `C` - Corporate & Owambe - `N40,000` (Monday + Friday, fixed)
- `F` - Full Experience - `N60,000` (all 5 days)

## Public Endpoints

### Get Packages

```http
GET /api/students/packages
```

### Identify/Create Student

```http
POST /api/students/identify
Content-Type: application/json
```

Corporate Plus example (T — Monday + 1 day):

```json
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

> `selectedDays` must contain exactly 1 day: `TUESDAY`, `WEDNESDAY`, or `THURSDAY`.
> Monday is automatically added by the backend.

Corporate & Owambe example (C — Monday + Friday, no selection needed):

```json
{
  "matricNumber": "ENG23003",
  "fullName": "Ada Obi",
  "gender": "female",
  "packageCode": "C",
  "email": "ada@example.com",
  "phone": "08098765432"
}
```

Full package example (F — all 5 days):

```json
{
  "matricNumber": "ENG23002",
  "fullName": "John Doe",
  "gender": "male",
  "packageCode": "F",
  "email": "john@example.com",
  "phone": "08012345678"
}
```

### Get Student Status

```http
GET /api/students/:matricNumber
```

### Select Package

```http
POST /api/students/select-package
Content-Type: application/json
```

```json
{
  "matricNumber": "ENG23001",
  "packageCode": "T",
  "selectedDays": ["WEDNESDAY"]
}
```

### Upgrade Package

```http
POST /api/students/upgrade-package
Content-Type: application/json
```

```json
{
  "matricNumber": "ENG23001",
  "newPackageCode": "F"
}
```

Notes:

- Only higher-priced upgrades are allowed.
- Previous payments are preserved.
- Invites are regenerated based on new package/day access after full payment.

### Initialize Payment

```http
POST /api/payments/initialize
Content-Type: application/json
```

```json
{
  "studentId": "ENG23001",
  "amount": 30000,
  "email": "jane@example.com"
}
```

Success response:

```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "authorization_url": "https://checkout.flutterwave.com/...",
    "reference": "FYW-1234567890-ABCD1234"
  }
}
```

### Verify Payment

```http
GET /api/payments/verify?reference=FYW-1234567890-ABCD1234
```

## Webhook

```http
POST /api/webhooks/flutterwave
verif-hash: your_webhook_secret_hash
Content-Type: application/json
```

## Payment Rules

1. One active package per student
2. Partial payments are supported
3. Overpayments are capped at package price
4. Upgrades preserve already paid amount
5. `T` (Corporate Plus): send 1 day in `selectedDays` (Tue/Wed/Thu); Monday auto-added
6. `C` (Corporate & Owambe): no `selectedDays` needed; Mon+Fri fixed
7. `F` grants all 5 days automatically

Payment statuses:

- `NOT_PAID`
- `PARTIALLY_PAID`
- `FULLY_PAID`

## Invite Generation

When payment becomes fully paid:

- Image invite is generated
- Invite includes:
  - student details
  - package details
  - allowed event days
  - QR code metadata (including selected days)
- Invite links are uploaded to Cloudinary and stored on the student record

## Admin Endpoints

Protected with `Authorization: Bearer <jwt_token>`.

- `POST /api/admin/auth/login`
- `GET /api/admin/metrics`
- `GET /api/admin/students`
- `GET /api/admin/students/:id`
- `POST /api/admin/students/:id/resend-invite`
- `POST /api/admin/students/:id/regenerate-invite`
- `GET /api/admin/export.csv`

CSV export includes `Selected Days`.

## Build and Test

```bash
npm run build
npm test
```

## Notes

- `FLUTTERWAVE_REDIRECT_URL` must be a valid public URL for checkout redirects.
- Webhook verification uses `FLUTTERWAVE_WEBHOOK_SECRET_HASH` and `verif-hash` header.
