# Final Year Week Backend API

Backend API for Final Year Week registration, package selection, payments, invite generation, and admin management.

## Features

- Package management with 2 options:
  - `T` (Two-Day Experience) - `N30,000`
  - `F` (Full Experience) - `N60,000`
- Student identify/create by matric number
- Two-day package day selection (`MONDAY` to `FRIDAY`, exactly 2)
- Flutterwave v3 payment initialization and verification
- Upgrade flow with payment preservation (`T -> F`)
- Automatic invite generation (PDF + image) with selected days included
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

- Package `T` requires exactly 2 unique day keys.
- Package `F` always grants all 5 days.

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

- `T` - Two-Day Experience - `N30,000`
- `F` - Full Experience - `N60,000`

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

Two-day example:

```json
{
  "matricNumber": "ENG23001",
  "fullName": "Jane Doe",
  "packageCode": "T",
  "email": "jane@example.com",
  "phone": "08012345678",
  "selectedDays": ["MONDAY", "FRIDAY"]
}
```

Full package example:

```json
{
  "matricNumber": "ENG23002",
  "fullName": "John Doe",
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
  "selectedDays": ["TUESDAY", "THURSDAY"]
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
5. `T` requires exactly 2 selected days
6. `F` grants all 5 days

Payment statuses:

- `NOT_PAID`
- `PARTIALLY_PAID`
- `FULLY_PAID`

## Invite Generation

When payment becomes fully paid:

- PDF and image invite are generated
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
