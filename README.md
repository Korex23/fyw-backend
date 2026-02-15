# Final Year Week Backend API

A production-ready backend API for managing Final Year Week payments and invitations with Paystack integration, invite generation, and admin dashboard.

## 🚀 Features

- **Package Management**: 4 packages (A-D) with different pricing and benefits
- **Student Management**: Identify/create students by matric number
- **Payment Processing**: Paystack integration with partial payments support
- **Package Upgrades**: Upgrade to higher-priced packages with payment preservation
- **Invite Generation**: Automatic PDF and image invite generation with QR codes
- **Email Notifications**: Automated emails for partial and complete payments
- **Admin Dashboard API**: Comprehensive admin endpoints for management
- **Webhook Handling**: Idempotent webhook processing with signature verification
- **Export Functionality**: CSV export of all student data

## 📋 Prerequisites

- Node.js >= 18.x
- MongoDB >= 5.x
- Paystack Account
- Cloudinary Account
- SMTP Email Service (Gmail, SendGrid, etc.)

## 🛠️ Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd final-year-week-backend
```

2. **Install dependencies**

```bash
npm install
```

4. **Seed the database with packages**

```bash
npm run seed
```

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Run Tests

```bash
npm test
```

The server will start on `http://localhost:5000`

## 📡 API Documentation

### Base URL

```
http://localhost:5000/api
```

### Public Endpoints

#### Health Check

```http
GET /api/health
```

#### Get All Packages

```http
GET /api/students/packages
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "code": "A",
      "name": "Basic Package",
      "price": 15000,
      "benefits": [...]
    }
  ]
}
```

#### Create/Identify Student

```http
POST /api/students/identify
Content-Type: application/json

{
  "matricNumber": "CSC/2020/001",
  "fullName": "John Doe",
  "packageCode": "B",
  "email": "john@example.com",
  "phone": "+2348012345678"
}
```

#### Get Student Status

```http
GET /api/students/:matricNumber
```

#### Select Package

```http
POST /api/students/select-package
Content-Type: application/json

{
  "matricNumber": "CSC/2020/001",
  "packageCode": "B"
}
```

#### Upgrade Package

```http
POST /api/students/upgrade-package
Content-Type: application/json

{
  "matricNumber": "CSC/2020/001",
  "newPackageCode": "C"
}
```

#### Initialize Payment

```http
POST /api/payments/initialize
Content-Type: application/json

{
  "studentId": "student_id_here",
  "amount": 10000,
  "email": "john@example.com"
}
```

Response:

```json
{
  "success": true,
  "message": "Payment initialized successfully",
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "reference": "FYW-1234567890-ABCD1234",
    "access_code": "..."
  }
}
```

#### Verify Payment

```http
GET /api/payments/verify?reference=FYW-1234567890-ABCD1234
```

### Webhook Endpoint

#### Paystack Webhook

```http
POST /api/webhooks/paystack
X-Paystack-Signature: signature_here
Content-Type: application/json

{
  "event": "charge.success",
  "data": {...}
}
```

### Admin Endpoints

#### Login

```http
POST /api/admin/auth/login
Content-Type: application/json

{
  "email": "admin@finalyearweek.com",
  "password": "your_password"
}
```

Response:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "jwt_token_here",
    "admin": {
      "email": "admin@finalyearweek.com"
    }
  }
}
```

#### Get Metrics (Protected)

```http
GET /api/admin/metrics
Authorization: Bearer <jwt_token>
```

Response:

```json
{
  "success": true,
  "data": {
    "totalStudents": 150,
    "fullyPaidCount": 80,
    "partiallyPaidCount": 40,
    "notPaidCount": 30,
    "totalRevenue": 3500000,
    "outstandingTotal": 1200000
  }
}
```

#### Get Students List (Protected)

```http
GET /api/admin/students?page=1&limit=20&status=PARTIALLY_PAID&search=john
Authorization: Bearer <jwt_token>
```

Query Parameters:

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by payment status (NOT_PAID, PARTIALLY_PAID, FULLY_PAID)
- `packageCode` (optional): Filter by package code (A, B, C, D)
- `search` (optional): Search by name or matric number

#### Get Student Details (Protected)

```http
GET /api/admin/students/:id
Authorization: Bearer <jwt_token>
```

#### Resend Invite (Protected)

```http
POST /api/admin/students/:id/resend-invite
Authorization: Bearer <jwt_token>
```

#### Regenerate Invite (Protected)

```http
POST /api/admin/students/:id/regenerate-invite
Authorization: Bearer <jwt_token>
```

#### Export Students CSV (Protected)

```http
GET /api/admin/export.csv
Authorization: Bearer <jwt_token>
```

## 🔐 Payment Rules

1. **One Package at a Time**: Students can only have one active package
2. **Partial Payments**: Multiple partial payments allowed until fully paid
3. **Upgrade Only**: Can only upgrade to higher-priced packages (no downgrades)
4. **Payment Preservation**: Previous payments are preserved during upgrades
5. **Overpayment Handling**: System caps credited amount to package price

### Payment Statuses

- `NOT_PAID`: No payment made
- `PARTIALLY_PAID`: Some payment made, balance remaining
- `FULLY_PAID`: Package fully paid

## 🎫 Invite Generation

When a student completes payment:

1. System generates PDF and PNG invites with:
   - Student name and matric number
   - Package details and benefits
   - QR code for verification
   - Professional design
2. Uploads to Cloudinary
3. Sends email with download links

## 🔄 Webhook Idempotency

Webhook idempotency is guaranteed through multiple mechanisms:

### 1. Database-Level Protection

- **Unique Index on WebhookEvent**: `{ eventId: 1, reference: 1 }`
- **Unique Index on Payment Reference**: Prevents duplicate payment records

### 2. Application-Level Checks

```typescript
// Check if event already processed
const existingEvent = await WebhookEvent.findOne({
  eventId,
  reference: data.reference,
});

if (existingEvent) {
  return; // Already processed
}

// Record event (will fail if duplicate due to unique index)
await WebhookEvent.create({
  eventId,
  reference: data.reference,
  event,
  processedAt: new Date(),
  rawPayload: eventData,
});
```

### 3. Payment Status Check

```typescript
if (payment.status === TransactionStatus.SUCCESS) {
  return payment; // Already processed
}
```

### Testing Idempotency

```bash
npm run test
```

The test suite includes:

- **Upgrade Test**: Verifies payment preservation during package upgrades
- **Webhook Idempotency Test**: Ensures duplicate webhooks don't double-credit

## 🔧 Paystack Webhook Setup

### 1. Get Your Webhook Secret

1. Log into Paystack Dashboard
2. Go to Settings > API Keys & Webhooks
3. Copy your webhook secret

### 2. Set Up ngrok (for local testing)

```bash
# Install ngrok
npm install -g ngrok

# Start your server
npm run dev

# In another terminal, start ngrok
ngrok http 5000
```

### 3. Configure Paystack Webhook

1. Copy your ngrok URL (e.g., `https://abcd1234.ngrok.io`)
2. In Paystack Dashboard, add webhook URL:
   ```
   https://abcd1234.ngrok.io/api/webhooks/paystack
   ```

### 4. Test Webhook

```bash
# Paystack will send test events
# Check your server logs for webhook processing
```

## 📧 Email Configuration

### Gmail Setup

1. Enable 2-Factor Authentication
2. Generate App-Specific Password
3. Use in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
```

### Other SMTP Services

- **SendGrid**: Use SMTP relay
- **Mailgun**: Use SMTP credentials
- **AWS SES**: Use SMTP endpoint

## ☁️ Cloudinary Setup

1. Create account at [cloudinary.com](https://cloudinary.com)
2. Get credentials from Dashboard
3. Add to `.env`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Files are uploaded to: `final-year-week/invites/` folder

## 🗂️ Project Structure

```
final-year-week-backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middlewares/     # Express middlewares
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   └── app.ts           # App entry point
├── scripts/
│   └── seed.ts          # Database seeding
├── tests/
│   ├── upgrade.test.ts  # Upgrade logic tests
│   └── webhook.test.ts  # Webhook idempotency tests
├── .env.example         # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## 🔍 Logging

The application uses Pino for structured logging:

- **Development**: Pretty-printed colored logs
- **Production**: JSON-formatted logs for log aggregation

## 🚨 Error Handling

Centralized error handling with custom error classes:

- `ValidationError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `NotFoundError` (404)
- `ConflictError` (409)

All errors return consistent JSON format:

```json
{
  "success": false,
  "message": "Error message here"
}
```

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Prevent abuse
- **JWT Authentication**: Secure admin routes
- **Webhook Signature Verification**: Validate Paystack webhooks
- **Input Validation**: Zod schema validation

## 📊 Database Indexes

Optimized queries with strategic indexes:

- `Student.matricNumber`: Unique index
- `Student.paymentStatus`: Query index
- `Payment.reference`: Unique index
- `WebhookEvent.{eventId, reference}`: Compound unique index

## 🚀 Deployment

### Environment Variables

Ensure all production environment variables are set:

- Use strong JWT secret
- Use production Paystack keys
- Configure production MongoDB
- Set up production email service

### Build

```bash
npm run build
```

### Start Production Server

```bash
NODE_ENV=production npm start
```

### Recommended Hosting

- **Backend**: Railway, Render, Heroku, AWS, DigitalOcean
- **Database**: MongoDB Atlas
- **File Storage**: Cloudinary (already configured)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 📝 License

ISC

## 🆘 Support

For issues or questions:

1. Check the logs for detailed error messages
2. Review the API documentation
3. Test webhook integration with ngrok
4. Verify environment variables are correct

## 🎉 Package Details

### Package A - Basic (₦15,000)

- Access to all week events
- Event T-shirt
- Souvenir booklet
- Certificate of participation

### Package B - Standard (₦25,000)

- All Basic Package benefits
- Event hoodie
- Personalized photo frame
- Access to VIP lounge
- Complimentary meal vouchers

### Package C - Premium (₦40,000)

- All Standard Package benefits
- Premium gift hamper
- Professional photo shoot session
- Priority seating at all events
- Exclusive after-party access
- Commemorative plaque

### Package D - Diamond (₦60,000)

- All Premium Package benefits
- Luxury gift box
- Video montage feature
- Reserved VIP parking
- Personal event assistant
- Lifetime alumni membership
- Custom engraved keepsake
