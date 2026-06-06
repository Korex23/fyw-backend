/**
 * Day-swap notification email.
 *
 * The event themes were swapped between Wednesday and Thursday:
 *   - Jersey Day  : Wednesday  ->  Thursday
 *   - Costume Day : Thursday   ->  Wednesday
 *
 * Students who picked a day to attend a particular theme keep their theme by
 * having their access day swapped. This builder produces the email explaining
 * the move and surfacing their freshly regenerated invite.
 */

export type DaySwapType =
  // Picked Wednesday (old Jersey Day) -> moved to Thursday (Jersey Day).
  | "WED_TO_THU"
  // Picked Thursday (old Costume Day) -> moved to Wednesday (Costume Day).
  | "THU_TO_WED";

export interface DaySwapEmailParams {
  fullName: string;
  packageName: string;
  imageUrl: string;
  swapType: DaySwapType;
}

const COPY: Record<
  DaySwapType,
  {
    theme: string;
    fromDay: string;
    toDay: string;
    intro: string;
  }
> = {
  WED_TO_THU: {
    theme: "Jersey Day",
    fromDay: "Wednesday",
    toDay: "Thursday",
    intro:
      "You are receiving this email because you selected <strong>Wednesday</strong> as your Jersey Day. Jersey Day has now moved to <strong>Thursday</strong>.",
  },
  THU_TO_WED: {
    theme: "Costume Day",
    fromDay: "Thursday",
    toDay: "Wednesday",
    intro:
      "You are receiving this email because you selected <strong>Thursday</strong>. Costume Day has now moved to <strong>Wednesday</strong>.",
  },
};

export function buildDaySwapEmail({
  fullName,
  packageName,
  imageUrl,
  swapType,
}: DaySwapEmailParams): { subject: string; html: string; text: string } {
  const { theme, fromDay, toDay, intro } = COPY[swapType];

  const subject = `📅 Schedule Update: ${theme} has moved to ${toDay}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ULES FYW PAY - Schedule Update</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }

    .wrapper { background: #F9FAFB; padding: 24px 12px; font-family: Arial, sans-serif; color: #0F172A; }
    .container { max-width: 640px; margin: 0 auto; }
    .card { background: #fff; border: 1px solid #E5E7EB; border-radius: 16px; overflow: hidden; box-shadow: 0 6px 24px -10px rgba(0,0,0,0.05); }
    .brandbar { padding: 18px 22px; background: rgba(255,255,255,0.9); border-bottom: 1px solid #E5E7EB; }
    .brand { font-weight: 800; letter-spacing: -0.02em; font-size: 18px; color: #1e293b; }
    .brand .g { color: #1B5E20; }
    .brand .r { color: #8B0000; }
    .hero { padding: 22px; background: radial-gradient(circle at 15% 20%, rgba(27,94,32,0.10) 0%, rgba(27,94,32,0) 60%), radial-gradient(circle at 85% 30%, rgba(139,0,0,0.10) 0%, rgba(139,0,0,0) 55%), #ffffff; }
    .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; background: rgba(139,0,0,0.08); color: #8B0000; border: 1px solid rgba(139,0,0,0.18); }
    .title { margin: 14px 0 6px; font-size: 26px; font-weight: 900; letter-spacing: -0.03em; color: #0f172a; }
    .subtitle { margin: 0; font-size: 14px; color: #64748B; font-weight: 600; line-height: 1.6; }
    .content { padding: 22px; background: #ffffff; }
    .p { margin: 0 0 12px; font-size: 14px; line-height: 1.7; color: #334155; font-weight: 500; }
    .change { margin: 16px 0; padding: 16px; border-radius: 14px; border: 1px solid rgba(27,94,32,0.18); background: rgba(27,94,32,0.06); text-align: center; }
    .changeRow { font-size: 18px; font-weight: 900; color: #0F172A; }
    .strike { color: #8B0000; text-decoration: line-through; }
    .arrow { color: #64748B; padding: 0 10px; }
    .newday { color: #1B5E20; }
    .changeNote { margin: 8px 0 0; font-size: 12px; font-weight: 700; color: #64748B; }
    .buttons { text-align: center; margin: 18px 0 6px; }
    .btn { display: inline-block; padding: 14px 18px; border-radius: 12px; text-decoration: none; font-weight: 900; font-size: 14px; margin: 6px; background: #1B5E20; color: #ffffff !important; box-shadow: 0 12px 26px -16px rgba(27,94,32,0.70); }
    .previewWrap { margin-top: 16px; border-radius: 14px; border: 1px solid #E5E7EB; background: #F8FAFC; padding: 14px; text-align: center; }
    .previewLabel { margin: 0 0 10px; font-size: 11px; font-weight: 900; letter-spacing: 0.20em; text-transform: uppercase; color: #94A3B8; }
    .previewImg { max-width: 100%; height: auto; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 10px 20px -16px rgba(0,0,0,0.25); }
    .footer { padding: 16px 22px; border-top: 1px solid #E5E7EB; background: #ffffff; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #94A3B8; font-weight: 600; line-height: 1.7; }
    @media (max-width: 480px) { .title { font-size: 22px; } .btn { width: 100%; box-sizing: border-box; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="card">
        <div class="brandbar">
          <div class="brand">ULES <span class="g">FYW</span> <span class="r">PAY</span></div>
        </div>
        <div class="hero">
          <span class="badge">Schedule Update</span>
          <h1 class="title">${theme} has moved 📅</h1>
          <p class="subtitle">Hi ${fullName}, there's a change to your event day. Please read below and download your updated invite.</p>
        </div>
        <div class="content">
          <p class="p">${intro}</p>

          <div class="change">
            <div class="changeRow">
              <span class="strike">${fromDay}</span>
              <span class="arrow">&rarr;</span>
              <span class="newday">${toDay}</span>
            </div>
            <p class="changeNote">Your access day has been updated automatically — no action needed from you.</p>
          </div>

          <p class="p">Your invitation has been regenerated to reflect the new day. Please download and use this updated invite at the event entrance.</p>

          <div class="buttons">
            <a class="btn" href="${imageUrl}" target="_blank" rel="noreferrer">🖼️ Download Updated Invite</a>
          </div>

          <div class="previewWrap">
            <p class="previewLabel">Updated Invite — ${packageName}</p>
            <img class="previewImg" src="${imageUrl}" alt="Your updated invitation" />
          </div>

          <p class="p" style="margin-top:16px;">We apologise for any inconvenience and look forward to celebrating with you!</p>
        </div>
        <div class="footer">
          <p><strong style="color:#1B5E20;">ULES</strong> • Final Year Week Planning Committee</p>
          <p>If you have any questions, reply to this email or contact support.</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const text = [
    `Hi ${fullName},`,
    "",
    `${theme} has moved from ${fromDay} to ${toDay}.`,
    `Your access day has been updated automatically from ${fromDay} to ${toDay} — no action needed from you.`,
    "",
    `Your invitation has been regenerated. Download your updated invite here: ${imageUrl}`,
    "",
    "ULES • Final Year Week Planning Committee",
  ].join("\n");

  return { subject, html, text };
}
