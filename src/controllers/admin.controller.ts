import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import studentService from "../services/student.service";
import inviteService from "../services/invite.service";
import mailService from "../services/mail.service";
import packageService from "../services/package.service";
import Student from "../models/Student";
import Payment from "../models/Payment";
import { PaymentStatus, TransactionStatus, AuthRequest } from "../types";
import { UnauthorizedError, BadRequestError } from "../utils/errors";
import { Parser } from "json2csv";

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

export const studentFiltersSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.enum(["NOT_PAID", "PARTIALLY_PAID", "FULLY_PAID"]).optional(),
    packageCode: z.string().optional(),
    search: z.string().optional(),
  }),
});

export class AdminController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      // Check credentials against env vars
      if (email !== env.ADMIN_EMAIL) {
        throw new UnauthorizedError("Invalid credentials");
      }

      const isMatch = await bcrypt.compare(
        password,
        await bcrypt.hash(env.ADMIN_PASSWORD, 10),
      );

      if (!isMatch && password !== env.ADMIN_PASSWORD) {
        throw new UnauthorizedError("Invalid credentials");
      }

      // Generate JWT
      const token = jwt.sign(
        {
          id: "admin",
          email: env.ADMIN_EMAIL,
        },
        env.JWT_SECRET as string,
        { expiresIn: env.JWT_EXPIRES_IN as any },
      );

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          token,
          admin: {
            email: env.ADMIN_EMAIL,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getMetrics(
    _req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const [totalStudents, fullyPaid, partiallyPaid, notPaid, totalRevenue] =
        await Promise.all([
          Student.countDocuments(),
          Student.countDocuments({ paymentStatus: PaymentStatus.FULLY_PAID }),
          Student.countDocuments({
            paymentStatus: PaymentStatus.PARTIALLY_PAID,
          }),
          Student.countDocuments({ paymentStatus: PaymentStatus.NOT_PAID }),
          Payment.aggregate([
            { $match: { status: TransactionStatus.SUCCESS } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ]),
        ]);

      // Calculate outstanding
      const students = await Student.find().populate("packageId");
      let outstandingTotal = 0;
      for (const student of students) {
        const pkg = student.packageId as any;
        const outstanding = Math.max(pkg.price - student.totalPaid, 0);
        outstandingTotal += outstanding;
      }

      res.status(200).json({
        success: true,
        data: {
          totalStudents,
          fullyPaidCount: fullyPaid,
          partiallyPaidCount: partiallyPaid,
          notPaidCount: notPaid,
          totalRevenue: totalRevenue[0]?.total || 0,
          outstandingTotal,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getStudents(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { page, limit, status, packageCode, search } = req.query;

      const result = await studentService.getAllStudents({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as PaymentStatus,
        packageCode: packageCode as string,
        search: search as string,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStudentDetails(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const result = await studentService.getStudentWithPaymentHistory(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async resendInvite(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const student = await studentService.getStudentById(id);

      if (!student.invites?.pdfUrl || !student.invites?.imageUrl) {
        throw new BadRequestError(
          "No invites found. Please regenerate invites first.",
        );
      }

      if (!student.email) {
        throw new BadRequestError("Student has no email address on file");
      }

      const pkg = await packageService.getPackageById(
        student.packageId._id.toString(),
      );

      await mailService.resendInvite(
        student.email,
        student.fullName,
        pkg.name,
        student.invites.pdfUrl,
        student.invites.imageUrl,
      );

      res.status(200).json({
        success: true,
        message: "Invite resent successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  async regenerateInvite(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params;

      const student = await studentService.getStudentById(id);
      const pkg = await packageService.getPackageById(
        student.packageId.toString(),
      );

      // Generate new invites
      const invites = await inviteService.generateInvites(student, pkg);

      // Update student
      await studentService.updateInvites(id, invites.pdfUrl, invites.imageUrl);

      // Send email if email exists
      if (student.email) {
        await mailService.sendPaymentCompletionEmail(
          student.email,
          student.fullName,
          pkg.name,
          invites.pdfUrl,
          invites.imageUrl,
        );
      }

      res.status(200).json({
        success: true,
        message: "Invites regenerated and sent successfully",
        data: invites,
      });
    } catch (error) {
      next(error);
    }
  }

  async exportCSV(
    _req: AuthRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const students = await Student.find().populate("packageId").lean();

      const csvData = students.map((student: any) => ({
        "Full Name": student.fullName,
        "Matric Number": student.matricNumber,
        Email: student.email || "N/A",
        Phone: String(student.phone) || "N/A",
        Package: student.packageId.name,
        "Package Price": student.packageId.price,
        "Selected Days":
          student.selectedDays && student.selectedDays.length > 0
            ? student.selectedDays.join(", ")
            : "N/A",
        "Total Paid": student.totalPaid,
        Outstanding: Math.max(student.packageId.price - student.totalPaid, 0),
        "Payment Status": student.paymentStatus,
        "Has Invite": student.invites?.pdfUrl ? "Yes" : "No",
        "Created At": new Date(student.createdAt).toISOString(),
      }));

      const parser = new Parser();
      const csv = parser.parse(csvData);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=students-export.csv",
      );
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminController();
