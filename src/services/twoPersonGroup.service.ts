import axios from "axios";
import Student from "../models/Student";
import Payment from "../models/Payment";
import TwoPersonGroupRegistration, {
  ITwoPersonGroupRegistration,
} from "../models/TwoPersonGroupRegistration";
import { PaymentStatus, TransactionStatus } from "../types";
import { BadRequestError, NotFoundError } from "../utils/errors";
import { generateReference } from "../utils/helpers";
import packageService from "./package.service";
import inviteService from "./invite.service";
import mailService from "./mail.service";
import logger from "../utils/logger";
import { env } from "../config/env";
import { EVENT_DAY_KEYS } from "../constants/eventDays";

const TWO_PERSON_GROUP_SIZE = 2;
const GROUP_PACKAGE_CODE = "F";
const GROUP_DISCOUNT_RATE = 0.1;

export interface TwoPersonGroupMemberInput {
  matricNumber: string;
  fullName: string;
  gender: "male" | "female";
  email?: string;
  phone?: string;
}

export class TwoPersonGroupService {
  private getGroupTotal(packagePrice: number): number {
    return Math.round(
      packagePrice * TWO_PERSON_GROUP_SIZE * (1 - GROUP_DISCOUNT_RATE),
    );
  }

  async registerGroup(
    memberInputs: TwoPersonGroupMemberInput[],
    payerEmail: string,
  ): Promise<{
    groupId: string;
    totalAmount: number;
    outstanding: number;
    members: Array<{ matricNumber: string; fullName: string; email?: string }>;
  }> {
    if (memberInputs.length !== TWO_PERSON_GROUP_SIZE) {
      throw new BadRequestError(
        `A two-person group must have exactly ${TWO_PERSON_GROUP_SIZE} members`,
      );
    }

    const matricNumbers = memberInputs.map((m) => m.matricNumber.toUpperCase());
    if (new Set(matricNumbers).size !== TWO_PERSON_GROUP_SIZE) {
      throw new BadRequestError("All members must have different matric numbers");
    }

    const fullPkg = await packageService.getPackageByCode(GROUP_PACKAGE_CODE);
    const totalAmount = this.getGroupTotal(fullPkg.price);

    const existingStudents = await Student.find({
      matricNumber: { $in: matricNumbers },
    });

    const blocked = existingStudents
      .map((s) => {
        if (s.paymentStatus === PaymentStatus.FULLY_PAID) {
          return `${s.matricNumber} (already fully paid)`;
        }
        if (s.groupRegistrationId || s.twoPersonGroupRegistrationId) {
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
        `These members cannot join a two-person group: ${blocked.join(
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

    const group = await TwoPersonGroupRegistration.create({
      members: groupMembers,
      payerEmail,
      totalAmount,
      totalPaid: 0,
      paymentStatus: "NOT_PAID",
    });

    await Promise.all(
      studentRecords.map((s) =>
        Student.findByIdAndUpdate(s._id, {
          twoPersonGroupRegistrationId: group._id,
        }),
      ),
    );

    logger.info(`Two-person group registration created: ${group._id}`);

    return {
      groupId: group._id.toString(),
      totalAmount,
      outstanding: totalAmount,
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
    const group = await TwoPersonGroupRegistration.findById(groupId);
    if (!group) throw new NotFoundError("Two-person group registration not found");

    if (group.paymentStatus === "FULLY_PAID") {
      throw new BadRequestError("This two-person group has already fully paid");
    }

    if (amount <= 0) throw new BadRequestError("Amount must be greater than 0");

    const committedAgg = await Payment.aggregate([
      {
        $match: {
          twoPersonGroupRegistrationId: group._id,
          status: TransactionStatus.SUCCESS,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const committed = committedAgg[0]?.total || 0;
    const outstanding = Math.max(group.totalAmount - committed, 0);

    if (outstanding <= 0) {
      throw new BadRequestError("This two-person group has already fully paid");
    }

    if (amount > outstanding) {
      throw new BadRequestError(
        `Amount exceeds the NGN ${outstanding.toLocaleString()} left to pay.`,
      );
    }

    const fullPkg = await packageService.getPackageByCode(GROUP_PACKAGE_CODE);

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

    redirectUrlObj.searchParams.set("type", "two-person-group");
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
      twoPersonGroupRegistrationId: groupId,
    });

    logger.info(
      `Two-person group payment initialized: ${reference} for group ${groupId}, amount: NGN ${amount}`,
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
            twoPersonGroupRegistrationId: groupId,
            packageCode: fullPkg.code,
            isTwoPersonGroupPayment: true,
          },
          customizations: {
            title: "ULES Final Year Week - 2-Person Group Package",
            description: `2-person Full Experience group - paying NGN ${amount.toLocaleString()} of NGN ${group.totalAmount.toLocaleString()}`,
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
        logger.error(
          { response },
          "Flutterwave two-person group payment initialize failed",
        );
        await Payment.findByIdAndDelete(payment._id);
        throw new BadRequestError(
          response.message || "Failed to initialize two-person group payment",
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
        "Failed to initialize two-person group payment";
      throw new BadRequestError(msg);
    }
  }

  async processGroupPayment(
    groupRegistrationId: string,
    amountPaid: number,
  ): Promise<void> {
    const group = await TwoPersonGroupRegistration.findById(groupRegistrationId);
    if (!group) {
      throw new NotFoundError("Two-person group registration not found");
    }

    const fullPkg = await packageService.getPackageByCode(GROUP_PACKAGE_CODE);

    const agg = await Payment.aggregate([
      {
        $match: {
          twoPersonGroupRegistrationId: group._id,
          status: TransactionStatus.SUCCESS,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const collected = agg[0]?.total || 0;
    const outstanding = Math.max(group.totalAmount - collected, 0);
    const isFullyPaid = collected >= group.totalAmount;
    const memberShare = Math.round(group.totalAmount / group.members.length);

    if (collected > group.totalAmount) {
      logger.warn(
        `Two-person group ${groupRegistrationId} overpaid: collected NGN ${collected} of NGN ${group.totalAmount} (NGN ${collected - group.totalAmount} over)`,
      );
    }

    logger.info(
      `Two-person group ${groupRegistrationId} payment: NGN ${collected} / NGN ${group.totalAmount} - outstanding NGN ${outstanding}`,
    );

    if (isFullyPaid) {
      const claimed = await TwoPersonGroupRegistration.findOneAndUpdate(
        { _id: group._id, paymentStatus: { $ne: "FULLY_PAID" } },
        { paymentStatus: "FULLY_PAID", totalPaid: collected },
        { new: true },
      );

      if (!claimed) {
        logger.info(
          `Two-person group ${groupRegistrationId} already finalized - skipping`,
        );
        return;
      }

      await this.finalizeGroup(claimed, fullPkg, memberShare);
      return;
    }

    group.totalPaid = collected;
    group.paymentStatus = collected > 0 ? "PARTIALLY_PAID" : "NOT_PAID";
    await group.save();

    const memberPaidShare = Math.min(
      Math.round(collected / group.members.length),
      memberShare,
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
              "Two-person group partial payment email failed",
            );
          }
        }
      }),
    );
  }

  private async finalizeGroup(
    group: ITwoPersonGroupRegistration,
    fullPkg: Awaited<ReturnType<typeof packageService.getPackageByCode>>,
    memberShare: number,
  ): Promise<void> {
    await Promise.all(
      group.members.map(async (member) => {
        const student = await Student.findById(member.studentId).populate(
          "packageId",
        );
        if (!student) {
          logger.warn(`Two-person group member student ${member.studentId} not found`);
          return;
        }

        student.totalPaid = memberShare;
        student.paymentStatus = PaymentStatus.FULLY_PAID;
        await student.save();

        logger.info(
          `Two-person group member ${student.matricNumber} marked as FULLY_PAID`,
        );

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
            "Two-person group invite generation or email failed for member",
          );
        }
      }),
    );

    logger.info(`Two-person group ${group._id} fully processed`);
  }

  async getGroupById(groupId: string): Promise<ITwoPersonGroupRegistration> {
    const group = await TwoPersonGroupRegistration.findById(groupId);
    if (!group) throw new NotFoundError("Two-person group registration not found");
    return group;
  }
}

export default new TwoPersonGroupService();
