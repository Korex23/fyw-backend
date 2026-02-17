import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import paymentService from "../services/payment.service";
import studentService from "../services/student.service";

export const initializePaymentSchema = z.object({
  body: z.object({
    studentId: z.string(),
    amount: z.number().positive(),
    email: z.string().email(),
  }),
});

export const verifyPaymentSchema = z.object({
  query: z.object({
    reference: z.string(),
  }),
});

export class PaymentController {
  async initializePayment(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { studentId, amount, email } = req.body;

      const result = await paymentService.initializePayment(
        studentId,
        amount,
        email,
      );

      res.status(200).json({
        success: true,
        message: "Payment initialized successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyPayment(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { reference } = req.query;

      const payment = await paymentService.verifyPayment(reference as string);
      const student = await studentService.getStudentById(
        payment.studentId.toString(),
      );
      const paymentData =
        typeof (payment as any).toObject === "function"
          ? (payment as any).toObject()
          : payment;

      res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        data: {
          ...paymentData,
          matricNumber: student.matricNumber,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new PaymentController();
