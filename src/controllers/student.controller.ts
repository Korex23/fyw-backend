import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import studentService from "../services/student.service";
import packageService from "../services/package.service";

export const createStudentSchema = z.object({
  body: z.object({
    matricNumber: z.string().min(5),
    fullName: z.string().min(2),
    packageCode: z.string().length(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    selectedDays: z.array(z.string()).optional(),
  }),
});

export const selectPackageSchema = z.object({
  body: z.object({
    matricNumber: z.string().min(5),
    packageCode: z.string().length(1),
    selectedDays: z.array(z.string()).optional(),
  }),
});

export const upgradePackageSchema = z.object({
  body: z.object({
    matricNumber: z.string().min(5),
    newPackageCode: z.string().length(1),
    selectedDays: z.array(z.string()).optional(),
  }),
});

export const getStudentSchema = z.object({
  params: z.object({
    matricNumber: z.string(),
  }),
});

export class StudentController {
  async createOrIdentifyStudent(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { matricNumber, fullName, packageCode, email, phone, selectedDays } =
        req.body;

      const result = await studentService.createOrIdentifyStudent(
        matricNumber,
        fullName,
        packageCode,
        email,
        phone,
        selectedDays,
      );

      res.status(200).json({
        success: true,
        message: "Student identified/created successfully",
        data: {
          student: result.student,
          package: {
            code: result.code,
            name: result.name,
            packageType: result.packageType,
            price: result.price,
            benefits: result.benefits,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getStudentByMatric(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { matricNumber } = req.params;

      const student =
        await studentService.getStudentByMatricNumber(matricNumber);
      const pkg = await packageService.getPackageById(
        student.packageId._id.toString(),
      );

      const outstanding = Math.max(pkg.price - student.totalPaid, 0);

      res.status(200).json({
        success: true,
        data: {
          student,
          package: pkg,
          outstanding,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async selectPackage(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { matricNumber, packageCode, selectedDays } = req.body;

      const student = await studentService.selectPackage(
        matricNumber,
        packageCode,
        selectedDays,
      );
      const pkg = await packageService.getPackageById(
        student.packageId.toString(),
      );

      res.status(200).json({
        success: true,
        message: "Package selected successfully",
        data: {
          student,
          package: pkg,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async upgradePackage(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { matricNumber, newPackageCode, selectedDays } = req.body;

      const student = await studentService.upgradePackage(
        matricNumber,
        newPackageCode,
        selectedDays,
      );
      const pkg = await packageService.getPackageById(
        student.packageId._id.toString(),
      );

      const outstanding = Math.max(pkg.price - student.totalPaid, 0);

      res.status(200).json({
        success: true,
        message: "Package upgraded successfully",
        data: {
          student,
          package: pkg,
          outstanding,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllPackages(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const packages = await packageService.getAllPackages();

      res.status(200).json({
        success: true,
        data: packages,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new StudentController();
