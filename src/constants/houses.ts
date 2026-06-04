// House configuration for the Final Year Week house system.
// Colour + WhatsApp group links are derived from the balanced assignment data
// (house_assignments_balanced.csv / email_outputs_balanced.json).

export const HOUSE_NAMES = ["Red", "Blue", "White", "Yellow", "Green"] as const;

export type HouseName = (typeof HOUSE_NAMES)[number];

export interface HouseConfig {
  name: HouseName;
  /** CSS colour token used by the email template (matches the original outputs). */
  color: string;
  /** WhatsApp group invite link for the house. */
  whatsappLink: string;
}

export const HOUSES: Record<HouseName, HouseConfig> = {
  Red: {
    name: "Red",
    color: "red",
    whatsappLink: "https://chat.whatsapp.com/LEuujPKFq58C5OdxNejS70",
  },
  Blue: {
    name: "Blue",
    color: "blue",
    whatsappLink: "https://chat.whatsapp.com/Js3BJEOBycNKyQQM699yBU",
  },
  White: {
    name: "White",
    color: "white",
    whatsappLink: "https://chat.whatsapp.com/Ftr5Kv3x3ID7NXBS98KWZo",
  },
  Yellow: {
    name: "Yellow",
    color: "yellow",
    whatsappLink: "https://chat.whatsapp.com/JzpFbIZ7LY4BsxgRV8Lj44",
  },
  Green: {
    name: "Green",
    color: "green",
    whatsappLink: "https://chat.whatsapp.com/BSWM3bOTzAp283FVnvTD8P",
  },
};

export function isHouseName(value: unknown): value is HouseName {
  return (
    typeof value === "string" && HOUSE_NAMES.includes(value as HouseName)
  );
}

/** Normalise a free-text house value (case-insensitive) to a canonical HouseName. */
export function normaliseHouse(value: string): HouseName | null {
  const match = HOUSE_NAMES.find(
    (h) => h.toLowerCase() === value.trim().toLowerCase(),
  );
  return match ?? null;
}

interface HouseEmailParams {
  fullName: string;
  gender: "male" | "female";
  house: HouseName;
}

/**
 * Builds the house-assignment email (subject / html / text) using the exact
 * template that produced email_outputs_balanced.json.
 */
export function buildHouseAssignmentEmail({
  fullName,
  gender,
  house,
}: HouseEmailParams): { subject: string; html: string; text: string } {
  const { color, whatsappLink } = HOUSES[house];
  const title = gender === "female" ? "Ms." : "Mr.";

  const subject = `🏠 Your House Assignment: ${house} House`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: ${color};
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background-color: #f9f9f9;
          padding: 20px;
          border-radius: 0 0 10px 10px;
          border: 1px solid #ddd;
          border-top: none;
        }
        .house-badge {
          display: inline-block;
          background-color: ${color};
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: bold;
          margin: 10px 0;
        }
        .button {
          display: inline-block;
          background-color: #25D366;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
          font-weight: bold;
        }
        .footer {
          font-size: 12px;
          color: #666;
          text-align: center;
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px solid #ddd;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏠 House Assignment</h1>
      </div>
      <div class="content">
        <h2>Hello ${title} ${fullName},</h2>

        <p>Congratulations on your full payment for the event! 🎉</p>

        <p>You have been assigned to:</p>

        <div style="text-align: center;">
          <div class="house-badge" style="background-color: ${color};">
            <strong>${house.toUpperCase()} HOUSE</strong>
          </div>
        </div>

        <p>Your house color is <strong style="color: ${color};">${house}</strong>.</p>

        <p>Click the button below to join your house WhatsApp group chat:</p>

        <div style="text-align: center;">
          <a href="${whatsappLink}" class="button" style="background-color: #25D366;">
            📱 Join ${house} House WhatsApp Group
          </a>
        </div>

        <p><strong>Important:</strong> Join your house group as soon as possible to receive important updates, connect with your housemates, and participate in house activities!</p>

        <p>If the button doesn't work, copy and paste this link into your browser:<br>
        <a href="${whatsappLink}">${whatsappLink}</a></p>

        <p>We look forward to seeing you there! 🎊</p>

        <p>Best regards,<br>
        <strong>The Event Team</strong></p>
      </div>
      <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;

  const text = `
HOUSE ASSIGNMENT

Hello ${title} ${fullName},

Congratulations on your full payment for the event! 🎉

You have been assigned to: ${house.toUpperCase()} HOUSE

Your house color is: ${house}

Join your house WhatsApp group using this link:
${whatsappLink}

Join as soon as possible to receive important updates and connect with your housemates!

Best regards,
The Event Team
  `;

  return { subject, html, text };
}
