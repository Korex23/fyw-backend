import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import groupService from "../services/group.service";
import Student from "../models/Student";

const matricNumberSchema = z
  .string()
  .regex(
    /^(1904|2104)\d{5}$/,
    "Matric number must start with 1904 or 2104 and contain exactly 9 digits",
  );

const memberSchema = z.object({
  matricNumber: matricNumberSchema,
  fullName: z.string().min(2),
  gender: z.enum(["male", "female"]),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const registerGroupSchema = z.object({
  body: z.object({
    members: z
      .array(memberSchema)
      .length(3, "Exactly 3 members are required for a group package"),
    payerEmail: z.string().email(),
  }),
});

export const initializeGroupPaymentSchema = z.object({
  params: z.object({
    groupId: z.string().min(1),
  }),
  body: z.object({
    amount: z.number().positive(),
    payerEmail: z.string().email(),
  }),
});

export const getGroupSchema = z.object({
  params: z.object({
    groupId: z.string().min(1),
  }),
});

export class GroupController {
  async registerGroup(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { members, payerEmail } = req.body;

      const result = await groupService.registerGroup(members, payerEmail);

      res.status(200).json({
        success: true,
        message:
          "Group registered successfully. Use the groupId to initialize payment.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async initializePayment(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { groupId } = req.params;
      const { amount, payerEmail } = req.body;

      const result = await groupService.initializeGroupPayment(
        groupId,
        amount,
        payerEmail,
      );

      res.status(200).json({
        success: true,
        message: "Group payment initialized successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getGroup(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { groupId } = req.params;
      const group = await groupService.getGroupById(groupId);

      const memberShare = Math.round(group.totalAmount / group.members.length);
      const membersWithStatus = await Promise.all(
        group.members.map(async (m) => {
          const student = await Student.findById(m.studentId);
          const memberPaid = student?.totalPaid ?? 0;
          return {
            matricNumber: m.matricNumber,
            fullName: m.fullName,
            email: m.email,
            paymentStatus: student?.paymentStatus ?? "NOT_PAID",
            share: memberShare,
            totalPaid: memberPaid,
            outstanding: Math.max(memberShare - memberPaid, 0),
            hasInvite: !!student?.invites?.imageUrl,
            inviteUrl: student?.invites?.imageUrl,
          };
        }),
      );

      res.status(200).json({
        success: true,
        data: {
          groupId: group._id,
          paymentStatus: group.paymentStatus,
          totalAmount: group.totalAmount,
          totalPaid: group.totalPaid,
          outstanding: group.totalAmount - group.totalPaid,
          payerEmail: group.payerEmail,
          members: membersWithStatus,
          createdAt: group.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new GroupController();
