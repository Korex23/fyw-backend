import axios from "axios";
import Student from "../models/Student";
import Payment from "../models/Payment";
import GroupRegistration, { IGroupRegistration } from "../models/GroupRegistration";
import { PaymentStatus, TransactionStatus } from "../types";
import { BadRequestError, NotFoundError } from "../utils/errors";
import { generateReference } from "../utils/helpers";
import packageService from "./package.service";
import inviteService from "./invite.service";
import mailService from "./mail.service";
import logger from "../utils/logger";
import { env } from "../config/env";
import { EVENT_DAY_KEYS } from "../constants/eventDays";

// 3 members x 60,000 = 180,000, less a 10% group discount = 162,000
const GROUP_TOTAL = 162000;
const GROUP_PACKAGE_CODE = "F";
const GROUP_SIZE = 3;
// Each member's honest share of the group total (keeps per-student totals summing to GROUP_TOTAL)
const GROUP_MEMBER_SHARE = Math.round(GROUP_TOTAL / GROUP_SIZE);

export interface GroupMemberInput {
  matricNumber: string;
  fullName: string;
  gender: "male" | "female";
  email?: string;
  phone?: string;
}

export class GroupService {
  async registerGroup(
    memberInputs: GroupMemberInput[],
    payerEmail: string,
  ): Promise<{
    groupId: string;
    totalAmount: number;
    outstanding: number;
    members: Array<{ matricNumber: string; fullName: string; email?: string }>;
  }> {
    if (memberInputs.length !== GROUP_SIZE) {
      throw new BadRequestError(`A group must have exactly ${GROUP_SIZE} members`);
    }

    const matricNumbers = memberInputs.map((m) => m.matricNumber.toUpperCase());
    if (new Set(matricNumbers).size !== GROUP_SIZE) {
      throw new BadRequestError("All members must have different matric numbers");
    }

    const fullPkg = await packageService.getPackageByCode(GROUP_PACKAGE_CODE);

    // Pre-flight: only block students whose balance has actually been committed.
    const existingStudents = await Student.find({
      matricNumber: { $in: matricNumbers },
    });

    const blocked = existingStudents
      .map((s) => {
        if (s.paymentStatus === PaymentStatus.FULLY_PAID) {
          return `${s.matricNumber} (already fully paid)`;
        }
        if (s.groupRegistrationId) {
          return `${s.matricNumber} (already in another group)`;
        }
        if (s.totalPaid > 0) {
          return `${s.matricNumber} (has already made an individual payment)`;
        }
        return null;
      })
      .filter((m): m is string => m !== null);

    if (blocked.length > 0) {
      throw new BadRequestError(
        `These members cannot join a group: ${blocked.join(
          ", ",
        )}. Resolve their existing registration first.`,
      );
    }

    const existingByMatric = new Map(
      existingStudents.map((s) => [s.matricNumber, s]),
    );

    const studentRecords = await Promise.all(
      memberInputs.map(async (input) => {
        let student = existingByMatric.get(input.matricNumber.toUpperCase());

        if (student) {
          // Safe to re-purpose: this student has no committed payment history.
          student.fullName = input.fullName;
          student.gender = input.gender;
          if (input.email) student.email = input.email;
          if (input.phone) student.phone = input.phone;
          student.packageId = fullPkg._id as any;
          student.selectedDays = [...EVENT_DAY_KEYS];
          student.paymentStatus = PaymentStatus.NOT_PAID;
          student.totalPaid = 0;
          student.invites = undefined;
          await student.save();
        } else {
          student = await Student.create({
            fullName: input.fullName,
            matricNumber: input.matricNumber.toUpperCase(),
            gender: input.gender,
            email: input.email,
            phone: input.phone,
            packageId: fullPkg._id,
            selectedDays: [...EVENT_DAY_KEYS],
            totalPaid: 0,
            paymentStatus: PaymentStatus.NOT_PAID,
          });
        }

        return student;
      }),
    );

    const groupMembers = studentRecords.map((s) => ({
      studentId: s._id as any,
      fullName: s.fullName,
      matricNumber: s.matricNumber,
      email: s.email,
    }));

    const group = await GroupRegistration.create({
      members: groupMembers,
      payerEmail,
      totalAmount: GROUP_TOTAL,
      totalPaid: 0,
      paymentStatus: "NOT_PAID",
    });

    // Stamp groupRegistrationId on each student for admin visibility.
    await Promise.all(
      studentRecords.map((s) =>
        Student.findByIdAndUpdate(s._id, { groupRegistrationId: group._id }),
      ),
    );

    logger.info(`Group registration created: ${group._id}`);

    return {
      groupId: group._id.toString(),
      totalAmount: GROUP_TOTAL,
      outstanding: GROUP_TOTAL,
      members: groupMembers.map((m) => ({
        matricNumber: m.matricNumber,
        fullName: m.fullName,
        email: m.email,
      })),
    };
  }

  async initializeGroupPayment(
    groupId: string,
    amount: number,
    payerEmail: string,
  ): Promise<{
    authorization_url: string;
    reference: string;
    amount: number;
    outstanding: number;
  }> {
    const group = await GroupRegistration.findById(groupId);
    if (!group) throw new NotFoundError("Group registration not found");

    if (group.paymentStatus === "FULLY_PAID") {
      throw new BadRequestError("This group has already fully paid");
    }

    if (amount <= 0) throw new BadRequestError("Amount must be greater than 0");

    // Only successful group payments reduce the outstanding balance.
    const committedAgg = await Payment.aggregate([
      {
        $match: {
          groupRegistrationId: group._id,
          status: TransactionStatus.SUCCESS,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const committed = committedAgg[0]?.total || 0;
    const outstanding = Math.max(GROUP_TOTAL - committed, 0);

    if (outstanding <= 0) {
      throw new BadRequestError("This group has already fully paid");
    }

    if (amount > outstanding) {
      throw new BadRequestError(
        `Amount exceeds the NGN ${outstanding.toLocaleString()} left to pay.`,
      );
    }

    const fullPkg = await packageService.getPackageByCode(GROUP_PACKAGE_CODE);

    // Attribute the payment to whichever member matches the payer's email so
    // per-student history is correct; fall back to the first member otherwise.
    const payerMember =
      group.members.find(
        (m) => m.email && m.email.toLowerCase() === payerEmail.toLowerCase(),
      ) || group.members[0];
    const payerStudent = await Student.findById(payerMember.studentId);
    if (!payerStudent) throw new NotFoundError("Payer student record not found");

    const redirectUrlObj = new URL(
      env.FLUTTERWAVE_REDIRECT_URL || `${env.FRONTEND_URL}/payment/verify`,
    );
    const redirectHost = redirectUrlObj.hostname.toLowerCase();
    if (redirectHost === "localhost" || redirectHost === "127.0.0.1") {
      throw new BadRequestError(
        "FLUTTERWAVE_REDIRECT_URL must be a public URL (localhost is invalid)",
      );
    }

    // Tag the redirect so the frontend knows this is a group payment and which
    // group to route back to once Flutterwave appends its own params.
    redirectUrlObj.searchParams.set("type", "group");
    redirectUrlObj.searchParams.set("groupId", groupId);
    const redirectUrl = redirectUrlObj.toString();

    const reference = generateReference();
    const chargeAmount = Math.ceil(amount / 0.98);

    const payment = await Payment.create({
      studentId: payerStudent._id,
      packageIdAtTime: fullPkg._id,
      amount,
      reference,
      status: TransactionStatus.PENDING,
      groupRegistrationId: groupId,
    });

    logger.info(
      `Group payment initialized: ${reference} for group ${groupId}, amount: NGN ${amount}`,
    );

    try {
      const { data: response } = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        {
          tx_ref: reference,
          amount: chargeAmount,
          currency: "NGN",
          redirect_url: redirectUrl,
          customer: {
            email: payerEmail,
            phonenumber: payerStudent.phone || "08000000000",
            name: payerStudent.fullName,
          },
          meta: {
            groupRegistrationId: groupId,
            packageCode: fullPkg.code,
            isGroupPayment: true,
          },
          customizations: {
            title: "ULES Final Year Week - Group Package",
            description: `Group Full Experience (3 members) - paying NGN ${amount.toLocaleString()} of NGN ${GROUP_TOTAL.toLocaleString()}`,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.status !== "success" || !response.data?.link) {
        logger.error({ response }, "Flutterwave group payment initialize failed");
        // Clean up the pending payment if Flutterwave rejected it.
        await Payment.findByIdAndDelete(payment._id);
        throw new BadRequestError(
          response.message || "Failed to initialize group payment",
        );
      }

      return {
        authorization_url: response.data.link,
        reference,
        amount,
        outstanding: outstanding - amount,
      };
    } catch (error: any) {
      if (error instanceof BadRequestError) throw error;
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to initialize group payment";
      throw new BadRequestError(msg);
    }
  }

  async processGroupPayment(
    groupRegistrationId: string,
    amountPaid: number,
  ): Promise<void> {
    const group = await GroupRegistration.findById(groupRegistrationId);
    if (!group) {
      throw new NotFoundError("Group registration not found");
    }

    const fullPkg = await packageService.getPackageByCode(GROUP_PACKAGE_CODE);

    // Source of truth = sum of all SUCCESS payments for this group.
    const agg = await Payment.aggregate([
      {
        $match: {
          groupRegistrationId: group._id,
          status: TransactionStatus.SUCCESS,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const collected = agg[0]?.total || 0;
    const outstanding = Math.max(GROUP_TOTAL - collected, 0);
    const isFullyPaid = collected >= GROUP_TOTAL;

    if (collected > GROUP_TOTAL) {
      logger.warn(
        `Group ${groupRegistrationId} overpaid: collected NGN ${collected} of NGN ${GROUP_TOTAL} (NGN ${collected - GROUP_TOTAL} over)`,
      );
    }

    logger.info(
      `Group ${groupRegistrationId} payment: NGN ${collected} / NGN ${GROUP_TOTAL} - outstanding NGN ${outstanding}`,
    );

    if (isFullyPaid) {
      // Atomically claim the fully-paid transition.
      const claimed = await GroupRegistration.findOneAndUpdate(
        { _id: group._id, paymentStatus: { $ne: "FULLY_PAID" } },
        { paymentStatus: "FULLY_PAID", totalPaid: collected },
        { new: true },
      );

      if (!claimed) {
        logger.info(`Group ${groupRegistrationId} already finalized - skipping`);
        return;
      }

      await this.finalizeGroup(claimed, fullPkg);
      return;
    }

    // Partial payment - record the true total and notify all members.
    group.totalPaid = collected;
    group.paymentStatus = collected > 0 ? "PARTIALLY_PAID" : "NOT_PAID";
    await group.save();

    const memberPaidShare = Math.min(
      Math.round(collected / GROUP_SIZE),
      GROUP_MEMBER_SHARE,
    );

    await Promise.all(
      group.members.map(async (member) => {
        await Student.findByIdAndUpdate(member.studentId, {
          paymentStatus: PaymentStatus.PARTIALLY_PAID,
          totalPaid: memberPaidShare,
        });

        if (member.email) {
          try {
            await mailService.sendGroupPartialPaymentEmail(
              member.email,
              member.fullName,
              amountPaid,
              collected,
              outstanding,
            );
          } catch (error) {
            logger.error(
              { memberMatric: member.matricNumber, error },
              "Group partial payment email failed",
            );
          }
        }
      }),
    );
  }

  // Marks every member fully paid, generates their invites, and emails them.
  // Called exactly once per group.
  private async finalizeGroup(
    group: IGroupRegistration,
    fullPkg: Awaited<ReturnType<typeof packageService.getPackageByCode>>,
  ): Promise<void> {
    await Promise.all(
      group.members.map(async (member) => {
        const student = await Student.findById(member.studentId).populate("packageId");
        if (!student) {
          logger.warn(`Group member student ${member.studentId} not found`);
          return;
        }

        student.totalPaid = GROUP_MEMBER_SHARE;
        student.paymentStatus = PaymentStatus.FULLY_PAID;
        await student.save();

        logger.info(`Group member ${student.matricNumber} marked as FULLY_PAID`);

        try {
          const invites = await inviteService.generateInvites(student, fullPkg);
          student.invites = {
            imageUrl: invites.imageUrl,
            generatedAt: invites.generatedAt,
          };
          await student.save();

          if (student.email) {
            await mailService.sendPaymentCompletionEmail(
              student.email,
              student.fullName,
              fullPkg.name,
              invites.imageUrl,
            );
          }
        } catch (error) {
          logger.error(
            { studentId: student._id.toString(), error },
            "Group invite generation or email failed for member",
          );
        }
      }),
    );

    logger.info(`Group ${group._id} fully processed - all invites sent`);
  }

  async getGroupById(groupId: string): Promise<IGroupRegistration> {
    const group = await GroupRegistration.findById(groupId);
    if (!group) throw new NotFoundError("Group registration not found");
    return group;
  }

  // Admin: delete a group along with all 3 member students and their payments.
  async deleteGroup(
    groupId: string,
  ): Promise<{ deletedMembers: number; deletedPayments: number }> {
    const group = await GroupRegistration.findById(groupId);
    if (!group) throw new NotFoundError("Group registration not found");

    const memberIds = group.members.map((m) => m.studentId);

    const paymentResult = await Payment.deleteMany({
      $or: [
        { groupRegistrationId: group._id },
        { studentId: { $in: memberIds } },
      ],
    });
    const studentResult = await Student.deleteMany({ _id: { $in: memberIds } });
    await GroupRegistration.findByIdAndDelete(groupId);

    logger.info(
      `Group ${groupId} deleted - ${studentResult.deletedCount} members, ${paymentResult.deletedCount} payments`,
    );

    return {
      deletedMembers: studentResult.deletedCount ?? 0,
      deletedPayments: paymentResult.deletedCount ?? 0,
    };
  }
}

export default new GroupService();
