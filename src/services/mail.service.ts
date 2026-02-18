import transporter from "../config/mail";
import { env } from "../config/env";
import logger from "../utils/logger";
import { formatCurrency } from "../utils/helpers";

export class MailService {
  async sendPartialPaymentEmail(
    to: string,
    fullName: string,
    amountPaid: number,
    totalPaid: number,
    outstanding: number,
    packageName: string,
    packagePrice: number,
  ): Promise<void> {
    const mailOptions = {
      from: env.EMAIL_FROM,
      to,
      subject: "✅ Payment Received - Final Year Week",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ULES FYW PAY - Payment Received</title>
  <style>
    /* Email-safe resets */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }

    :root {
      --primary: #1B5E20;
      --secondary: #8B0000;
      --bg: #F9FAFB;
      --card: #FFFFFF;
      --border: #E5E7EB;
      --slate: #0F172A;
      --muted: #64748B;
      --soft: rgba(0,0,0,0.05);
    }

    .wrapper {
      background: var(--bg);
      padding: 24px 12px;
      font-family: Arial, sans-serif;
      color: var(--slate);
    }

    .container {
      max-width: 640px;
      margin: 0 auto;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 6px 24px -10px var(--soft);
    }

    .brandbar {
      padding: 18px 22px;
      background: rgba(255,255,255,0.9);
      border-bottom: 1px solid var(--border);
    }

    .brand {
      font-weight: 800;
      letter-spacing: -0.02em;
      font-size: 18px;
      color: #1e293b;
    }
    .brand .g { color: var(--primary); }
    .brand .r { color: var(--secondary); }

    .hero {
      padding: 22px;
      background:
        radial-gradient(circle at 15% 20%, rgba(27,94,32,0.10) 0%, rgba(27,94,32,0) 60%),
        radial-gradient(circle at 85% 30%, rgba(139,0,0,0.10) 0%, rgba(139,0,0,0) 55%),
        #ffffff;
    }

    .badge {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      background: rgba(27,94,32,0.08);
      color: var(--primary);
      border: 1px solid rgba(27,94,32,0.18);
    }

    .title {
      margin: 14px 0 6px;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: #0f172a;
    }

    .subtitle {
      margin: 0;
      font-size: 14px;
      color: var(--muted);
      font-weight: 600;
      line-height: 1.6;
    }

    .content {
      padding: 22px;
      background: #ffffff;
    }

    .p {
      margin: 0 0 12px;
      font-size: 14px;
      line-height: 1.7;
      color: #334155;
      font-weight: 500;
    }

    .panel {
      margin: 16px 0;
      padding: 16px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: #F8FAFC;
    }

    .panel-title {
      margin: 0 0 12px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.20em;
      text-transform: uppercase;
      color: #94A3B8;
    }

    .row {
      width: 100%;
      border-collapse: collapse;
    }

    .row td {
      padding: 10px 0;
      border-bottom: 1px solid #E2E8F0;
      font-size: 14px;
    }

    .row tr:last-child td {
      border-bottom: none;
    }

    .label {
      color: #64748B;
      font-weight: 700;
    }

    .value {
      color: #0F172A;
      font-weight: 900;
      text-align: right;
      white-space: nowrap;
    }

    .outstandingWrap {
      margin-top: 12px;
      border-radius: 12px;
      padding: 14px;
      background: rgba(139,0,0,0.06);
      border: 1px solid rgba(139,0,0,0.16);
    }

    .outstandingLabel {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(139,0,0,0.85);
      margin: 0 0 6px;
    }

    .outstandingValue {
      font-size: 22px;
      font-weight: 900;
      color: var(--secondary);
      margin: 0;
    }

    .ctaWrap {
      text-align: center;
      padding: 18px 0 6px;
    }

    .btn {
      display: inline-block;
      padding: 14px 18px;
      border-radius: 12px;
      background: var(--primary);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 900;
      font-size: 14px;
      letter-spacing: 0.02em;
      box-shadow: 0 10px 24px -14px rgba(27,94,32,0.6);
    }

    .mutedNote {
      margin: 10px 0 0;
      font-size: 12px;
      color: #94A3B8;
      font-weight: 600;
      line-height: 1.6;
      text-align: center;
    }

    .footer {
      padding: 16px 22px;
      border-top: 1px solid var(--border);
      background: #ffffff;
      text-align: center;
    }

    .footer p {
      margin: 0;
      font-size: 12px;
      color: #94A3B8;
      font-weight: 600;
      line-height: 1.7;
    }

    /* small screens */
    @media (max-width: 480px) {
      .title { font-size: 22px; }
      .value { font-size: 13px; }
      .btn { width: 100%; box-sizing: border-box; }
    }
  </style>
</head>

<body>
  <div class="wrapper">
    <div class="container">
      <div class="card">

        <div class="brandbar">
          <div class="brand">
            ULES <span class="g">FYW</span> <span class="r">PAY</span>
          </div>
        </div>

        <div class="hero">
          <span class="badge">Payment Received</span>
          <h1 class="title">Thanks, ${fullName}! 🎉</h1>
          <p class="subtitle">
            We’ve received your payment towards the <strong>${packageName}</strong> package.
            Your account has been updated.
          </p>
        </div>

        <div class="content">
          <p class="p">
            Hello <strong>${fullName}</strong>, thank you for making a payment. Below is a quick summary.
          </p>

          <div class="panel">
            <p class="panel-title">Payment Summary</p>

            <table class="row" role="presentation">
              <tr>
                <td class="label">Amount Just Paid</td>
                <td class="value">${formatCurrency(amountPaid * 100)}</td>
              </tr>
              <tr>
                <td class="label">Total Paid So Far</td>
                <td class="value">${formatCurrency(totalPaid * 100)}</td>
              </tr>
              <tr>
                <td class="label">Package Price</td>
                <td class="value">${formatCurrency(packagePrice * 100)}</td>
              </tr>
            </table>

            <div class="outstandingWrap">
              <p class="outstandingLabel">Outstanding Balance</p>
              <p class="outstandingValue">${formatCurrency(outstanding * 100)}</p>
            </div>
          </div>

          <p class="p">
            To complete your registration and receive your invitation, please pay the outstanding balance.
          </p>

          <div class="ctaWrap">
            <a class="btn" href="${env.FRONTEND_URL}/login">Complete Payment</a>
          </div>

          <p class="mutedNote">
            If you already completed payment, ignore this email and check your dashboard for invite download links.
          </p>
        </div>

        <div class="footer">
          <p><strong style="color:#1B5E20;">ULES</strong> • Final Year Week Planning Committee</p>
          <p>If you have questions, reply to this email or contact support.</p>
        </div>

      </div>
    </div>
  </div>
</body>
</html>
`,
    };

    try {
      await transporter.sendMail(mailOptions);
      logger.info(`Partial payment email sent to ${to}`);
    } catch (error) {
      logger.error("Failed to send partial payment email:", error);
    }
  }

  async sendPaymentCompletionEmail(
    to: string,
    fullName: string,
    packageName: string,
    imageUrl: string,
  ): Promise<void> {
    const mailOptions = {
      from: env.EMAIL_FROM,
      to,
      subject: "🎉 Payment Complete - Your Final Year Week Invitation",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ULES FYW PAY - Invite Ready</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }

    :root {
      --primary: #1B5E20;
      --secondary: #8B0000;
      --bg: #F9FAFB;
      --card: #FFFFFF;
      --border: #E5E7EB;
      --slate: #0F172A;
      --muted: #64748B;
      --soft: rgba(0,0,0,0.06);
    }

    .wrapper {
      background: var(--bg);
      padding: 24px 12px;
      font-family: Arial, sans-serif;
      color: var(--slate);
    }

    .container {
      max-width: 640px;
      margin: 0 auto;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 28px -18px var(--soft);
    }

    .brandbar {
      padding: 18px 22px;
      background: rgba(255,255,255,0.92);
      border-bottom: 1px solid var(--border);
    }

    .brand {
      font-weight: 900;
      letter-spacing: -0.02em;
      font-size: 18px;
      color: #1e293b;
    }
    .brand .g { color: var(--primary); }
    .brand .r { color: var(--secondary); }

    .hero {
      padding: 22px;
      background:
        radial-gradient(circle at 15% 20%, rgba(27,94,32,0.12) 0%, rgba(27,94,32,0) 60%),
        radial-gradient(circle at 85% 30%, rgba(139,0,0,0.10) 0%, rgba(139,0,0,0) 55%),
        #ffffff;
    }

    .pill {
      display: inline-block;
      padding: 8px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      background: rgba(27,94,32,0.08);
      color: var(--primary);
      border: 1px solid rgba(27,94,32,0.18);
    }

    .title {
      margin: 14px 0 6px;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: #0f172a;
    }

    .subtitle {
      margin: 0;
      font-size: 14px;
      color: var(--muted);
      font-weight: 600;
      line-height: 1.6;
    }

    .content {
      padding: 22px;
      background: #ffffff;
    }

    .p {
      margin: 0 0 12px;
      font-size: 14px;
      line-height: 1.7;
      color: #334155;
      font-weight: 500;
    }

    .highlight {
      border-radius: 14px;
      border: 1px solid rgba(27,94,32,0.18);
      background: rgba(27,94,32,0.06);
      padding: 14px 16px;
      margin: 14px 0 18px;
    }

    .highlightTitle {
      margin: 0 0 6px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(27,94,32,0.85);
    }

    .highlightText {
      margin: 0;
      font-size: 14px;
      font-weight: 800;
      color: #0F172A;
    }

    .buttons {
      text-align: center;
      margin: 18px 0 6px;
    }

    .btn {
      display: inline-block;
      padding: 14px 18px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 900;
      font-size: 14px;
      letter-spacing: 0.02em;
      margin: 6px;
    }

    .btnPrimary {
      background: var(--primary);
      color: #ffffff !important;
      box-shadow: 0 12px 26px -16px rgba(27,94,32,0.70);
    }

    .btnSecondary {
      background: #ffffff;
      color: var(--secondary) !important;
      border: 1px solid rgba(139,0,0,0.35);
    }

    .previewWrap {
      margin-top: 16px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: #F8FAFC;
      padding: 14px;
      text-align: center;
    }

    .previewLabel {
      margin: 0 0 10px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.20em;
      text-transform: uppercase;
      color: #94A3B8;
    }

    .previewImg {
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      border: 1px solid #E2E8F0;
      box-shadow: 0 10px 20px -16px rgba(0,0,0,0.25);
    }

    .note {
      margin-top: 16px;
      border-radius: 14px;
      border: 1px solid rgba(139,0,0,0.16);
      background: rgba(139,0,0,0.05);
      padding: 14px 16px;
    }

    .noteTitle {
      margin: 0 0 6px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(139,0,0,0.85);
    }

    .noteText {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      line-height: 1.6;
    }

    .footer {
      padding: 16px 22px;
      border-top: 1px solid var(--border);
      background: #ffffff;
      text-align: center;
    }

    .footer p {
      margin: 0;
      font-size: 12px;
      color: #94A3B8;
      font-weight: 600;
      line-height: 1.7;
    }

    @media (max-width: 480px) {
      .title { font-size: 22px; }
      .btn { width: 100%; box-sizing: border-box; }
    }
  </style>
</head>

<body>
  <div class="wrapper">
    <div class="container">
      <div class="card">

        <div class="brandbar">
          <div class="brand">
            ULES <span class="g">FYW</span> <span class="r">PAY</span>
          </div>
        </div>

        <div class="hero">
          <span class="pill">✓ Fully Paid</span>
          <h1 class="title">Congratulations, ${fullName}! 🎉</h1>
          <p class="subtitle">
            Your payment for <strong>${packageName}</strong> is complete. Your official invitation is ready.
          </p>
        </div>

        <div class="content">
          <p class="p">
            Hello <strong>${fullName}</strong>, thanks for completing your payment. You can download your invite below.
          </p>

          <div class="highlight">
            <p class="highlightTitle">Invitation Ready</p>
            <p class="highlightText">Download your invite instantly.</p>
          </div>

          <div class="buttons">
            <a class="btn btnPrimary" href="${imageUrl}" target="_blank" rel="noreferrer">
              🖼️ Download Image
            </a>
          </div>

          <p class="p" style="text-align:center; color:#94A3B8; font-size:12px; font-weight:600;">
            You can also view your status anytime from your dashboard.
            <br />
            <a href="${env.FRONTEND_URL}/login" style="color:#1B5E20; font-weight:800; text-decoration:none;">
              Open Dashboard
            </a>
          </p>

          <div class="previewWrap">
            <p class="previewLabel">Preview</p>
            <img class="previewImg" src="${imageUrl}" alt="Your Invitation" />
          </div>

          <div class="note">
            <p class="noteTitle">Important</p>
            <p class="noteText">
              Please keep your invitation safe. You may be required to present it at the event entrance.
            </p>
          </div>

          <p class="p" style="margin-top:16px;">
            We look forward to celebrating with you!
          </p>
        </div>

        <div class="footer">
          <p><strong style="color:#1B5E20;">ULES</strong> • Final Year Week Planning Committee</p>
          <p>If you have any questions, reply to this email or contact support.</p>
        </div>

      </div>
    </div>
  </div>
</body>
</html>
`,
    };

    try {
      await transporter.sendMail(mailOptions);
      logger.info(`Completion email sent to ${to}`);
    } catch (error) {
      logger.error("Failed to send completion email:", error);
    }
  }

  async resendInvite(
    to: string,
    fullName: string,
    packageName: string,
    imageUrl: string,
  ): Promise<void> {
    await this.sendPaymentCompletionEmail(
      to,
      fullName,
      packageName,
      imageUrl,
    );
  }
}

export default new MailService();
