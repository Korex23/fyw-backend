import QRCode from "qrcode";
import cloudinary from "../config/cloudinary";
import { IStudent } from "../models/Student";
import { IPackage } from "../models/Package";
import { InviteData } from "../types";
import logger from "../utils/logger";
import { EVENT_DAY_KEYS, EVENT_DAY_LABEL_MAP } from "../constants/eventDays";

export class InviteService {
  private escapeXml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private buildInviteSvg(
    student: IStudent,
    pkg: IPackage,
    qrDataUrl: string,
    selectedDayLabels: string[],
  ): string {
    const benefits = (pkg.benefits || []).slice(0, 6);
    const days = selectedDayLabels.length
      ? selectedDayLabels
      : ["No event days selected"];

    const benefitRows = benefits
      .map(
        (benefit, index) => `
    <text x="70" y="${352 + index * 34}" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#1e293b">
      • ${this.escapeXml(benefit)}
    </text>`,
      )
      .join("");

    const dayRows = days
      .slice(0, 6)
      .map(
        (day, index) => `
    <text x="70" y="${620 + index * 34}" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#334155">
      • ${this.escapeXml(day)}
    </text>`,
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="900" viewBox="0 0 1200 900" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="900" fill="url(#bg)"/>
  <rect x="30" y="30" width="1140" height="840" rx="28" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>

  <rect x="30" y="30" width="1140" height="110" rx="28" fill="#f8fafc"/>
  <text x="70" y="95" font-family="Arial, sans-serif" font-size="36" font-weight="900" fill="#0f172a">
    ULES FYW PAY
  </text>
  <text x="1130" y="95" text-anchor="end" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#1b5e20">
    OFFICIAL INVITATION
  </text>

  <text x="70" y="200" font-family="Arial, sans-serif" font-size="54" font-weight="900" fill="#0f172a">
    Final Year Week
  </text>
  <text x="70" y="238" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#64748b">
    University of Lagos Engineering Society
  </text>

  <text x="70" y="298" font-family="Arial, sans-serif" font-size="26" font-weight="900" fill="#1e293b">
    ${this.escapeXml(student.fullName)}
  </text>
  <text x="70" y="326" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#475569">
    Matric No: ${this.escapeXml(student.matricNumber)}
  </text>

  <text x="70" y="500" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#1b5e20">
    PACKAGE: ${this.escapeXml(pkg.name)}
  </text>
  ${benefitRows}

  <text x="70" y="580" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#8b0000">
    ACCESS DAYS
  </text>
  ${dayRows}

  <rect x="860" y="250" width="270" height="320" rx="20" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
  <image x="895" y="285" width="200" height="200" href="${this.escapeXml(qrDataUrl)}"/>
  <text x="995" y="520" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#64748b">
    SCAN TO VERIFY
  </text>

  <text x="70" y="830" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#64748b">
    Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
  </text>
  <text x="1130" y="830" text-anchor="end" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#1b5e20">
    Final Year Week Planning Committee
  </text>
</svg>`;
  }

  async generateInvites(student: IStudent, pkg: IPackage): Promise<InviteData> {
    logger.info(`Generating invite for student ${student.matricNumber}`);

    const selectedDayKeys =
      pkg.packageType === "FULL"
        ? [...EVENT_DAY_KEYS]
        : student.selectedDays || [];
    const selectedDayLabels = selectedDayKeys.map(
      (day) => EVENT_DAY_LABEL_MAP[day] || day,
    );

    const qrData = JSON.stringify({
      matricNumber: student.matricNumber,
      fullName: student.fullName,
      package: pkg.code,
      selectedDays: selectedDayLabels,
      generatedAt: new Date().toISOString(),
    });

    const qrDataUrl = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 1,
    });

    const inviteSvg = this.buildInviteSvg(
      student,
      pkg,
      qrDataUrl,
      selectedDayLabels,
    );
    const inviteBuffer = Buffer.from(inviteSvg, "utf-8");

    const imageUrl = await this.uploadToCloudinary(
      inviteBuffer,
      `invite-${student.matricNumber}.svg`,
    );

    logger.info(`Invite generated successfully for ${student.matricNumber}`);

    return {
      imageUrl,
      generatedAt: new Date(),
    };
  }

  private async uploadToCloudinary(
    buffer: Buffer,
    filename: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "final-year-week/invites",
          public_id: filename.replace(/\.[^/.]+$/, ""),
          resource_type: "image",
          format: "svg",
        },
        (error, result) => {
          if (error) {
            logger.error("Cloudinary upload error:", error);
            reject(error);
            return;
          }
          resolve(result!.secure_url);
        },
      );

      uploadStream.end(buffer);
    });
  }
}

export default new InviteService();
