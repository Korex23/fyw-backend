import Student, { IStudent } from "../models/Student";
import { IPackage } from "../models/Package";
import Payment from "../models/Payment";
import { PaymentStatus } from "../types";
import { NotFoundError, BadRequestError } from "../utils/errors";
import packageService from "./package.service";
import logger from "../utils/logger";
import { EVENT_DAY_KEYS, EventDayKey } from "../constants/eventDays";
import { getEffectivePrice } from "../constants/discounts";

export class StudentService {
  private normalizeAndValidateDays(
    selectedDays: string[] | undefined,
    expectedCount: number,
  ): EventDayKey[] {
    const days = Array.from(
      new Set((selectedDays || []).map((day) => day.toUpperCase())),
    ) as EventDayKey[];

    if (days.length !== expectedCount) {
      throw new BadRequestError(`You must select exactly ${expectedCount} days`);
    }

    const hasInvalidDay = days.some((day) => !EVENT_DAY_KEYS.includes(day));
    if (hasInvalidDay) {
      throw new BadRequestError("Selected days contain invalid day values");
    }

    return days;
  }

  private resolveSelectedDaysForPackage(
    packageType: "FULL" | "TWO_DAY" | "CORPORATE_OWAMBE" | "CORPORATE_PLUS",
    selectedDays?: string[],
  ): EventDayKey[] {
    if (packageType === "FULL") {
      return [...EVENT_DAY_KEYS];
    }

    if (packageType === "CORPORATE_OWAMBE") {
      // Anchor day is either Monday (Corporate Day) or Friday (Owambe Day) — student picks one,
      // plus exactly 2 other days from the remaining weekdays (3 days total).
      const days = Array.from(
        new Set((selectedDays || []).map((d) => d.toUpperCase())),
      ) as EventDayKey[];

      if (days.length !== 3) {
        throw new BadRequestError(
          "This package requires exactly 3 days: Monday or Friday as your anchor day, plus any 2 other days",
        );
      }

      if (days.some((d) => !EVENT_DAY_KEYS.includes(d))) {
        throw new BadRequestError("Selected days contain invalid day values");
      }

      const anchorDays = days.filter((d) => d === "MONDAY" || d === "FRIDAY");
      if (anchorDays.length !== 1) {
        throw new BadRequestError(
          "This package requires exactly one anchor day: either Monday (Corporate Day) or Friday (Owambe Day)",
        );
      }

      return days;
    }

    if (packageType === "CORPORATE_PLUS") {
      // Any 2 days except Friday
      const days = Array.from(
        new Set((selectedDays || []).map((d) => d.toUpperCase())),
      ) as EventDayKey[];

      if (days.includes("FRIDAY")) {
        throw new BadRequestError(
          "Corporate Plus package does not include Friday. Please select 2 days from Monday to Thursday",
        );
      }

      if (days.length !== 2) {
        throw new BadRequestError(
          "Corporate Plus package requires exactly 2 days (any days except Friday)",
        );
      }

      const ALLOWED: EventDayKey[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"];
      if (days.some((d) => !ALLOWED.includes(d))) {
        throw new BadRequestError(
          "Corporate Plus package: days must be Monday, Tuesday, Wednesday, or Thursday",
        );
      }

      return days;
    }

    // TWO_DAY (legacy): any 2 days
    return this.normalizeAndValidateDays(selectedDays, 2);
  }

  async createOrIdentifyStudent(
    matricNumber: string,
    fullName: string,
    packageCode: string,
    gender: "male" | "female",
    email?: string,
    phone?: string,
    selectedDays?: string[],
  ): Promise<IPackage & { student: IStudent }> {
    const pkg = await packageService.getPackageByCode(packageCode);
    const resolvedDays = this.resolveSelectedDaysForPackage(
      pkg.packageType,
      selectedDays,
    );

    let student = await Student.findOne({
      matricNumber: matricNumber.toUpperCase(),
    });

    if (student) {
      if (fullName) student.fullName = fullName;
      if (gender) student.gender = gender;
      if (email) student.email = email;
      if (phone) student.phone = phone;
      if (selectedDays && student.packageId.toString() === pkg._id.toString()) {
        student.selectedDays = resolvedDays;
      }
      await student.save();
    } else {
      student = await Student.create({
        fullName,
        matricNumber: matricNumber.toUpperCase(),
        gender,
        email,
        phone,
        packageId: pkg._id,
        selectedDays: resolvedDays,
        totalPaid: 0,
        paymentStatus: PaymentStatus.NOT_PAID,
      });
    }

    return { ...pkg.toObject(), student };
  }

  async getStudentByMatricNumber(matricNumber: string): Promise<IStudent> {
    const student = await Student.findOne({
      matricNumber: matricNumber.toUpperCase(),
    }).populate("packageId");

    if (!student) {
      throw new NotFoundError("Student not found");
    }

    return student;
  }

  async getStudentById(id: string): Promise<IStudent> {
    const student = await Student.findById(id).populate("packageId");

    if (!student) {
      throw new NotFoundError("Student not found");
    }

    return student;
  }

  async selectPackage(
    matricNumber: string,
    packageCode: string,
    selectedDays?: string[],
  ): Promise<IStudent> {
    const student = await this.getStudentByMatricNumber(matricNumber);
    const pkg = await packageService.getPackageByCode(packageCode);
    const resolvedDays = this.resolveSelectedDaysForPackage(
      pkg.packageType,
      selectedDays,
    );

    student.packageId = pkg._id;
    student.selectedDays = resolvedDays;
    student.paymentStatus = PaymentStatus.NOT_PAID;
    student.totalPaid = 0;
    student.invites = undefined;

    return await student.save();
  }

  async upgradePackage(
    matricNumber: string,
    newPackageCode: string,
    selectedDays?: string[],
  ): Promise<IStudent> {
    const student = await this.getStudentByMatricNumber(matricNumber);
    const currentPackage = await packageService.getPackageById(
      student.packageId._id.toString(),
    );
    const newPackage = await packageService.getPackageByCode(newPackageCode);

    // Validate upgrade (only allow to higher-priced package)
    if (newPackage.price <= currentPackage.price) {
      throw new BadRequestError(
        "Can only upgrade to a higher-priced package. Downgrades are not allowed.",
      );
    }

    logger.info(
      `Upgrading student ${matricNumber} from ${currentPackage.code} (₦${currentPackage.price}) to ${newPackage.code} (₦${newPackage.price}). Current paid: ₦${student.totalPaid}`,
    );

    // Update package, preserve payments
    student.packageId = newPackage._id;
    student.selectedDays = this.resolveSelectedDaysForPackage(
      newPackage.packageType,
      selectedDays,
    );
    student.invites = undefined;

    // Recalculate status
    if (student.totalPaid === 0) {
      student.paymentStatus = PaymentStatus.NOT_PAID;
    } else if (student.totalPaid >= newPackage.price) {
      student.paymentStatus = PaymentStatus.FULLY_PAID;
    } else {
      student.paymentStatus = PaymentStatus.PARTIALLY_PAID;
    }

    return await student.save();
  }

  async downgradePackage(
    matricNumber: string,
    newPackageCode: string,
    selectedDays?: string[],
  ): Promise<IStudent> {
    const student = await this.getStudentByMatricNumber(matricNumber);

    if (student.paymentStatus === PaymentStatus.FULLY_PAID) {
      throw new BadRequestError(
        "Cannot downgrade a package after payment is complete.",
      );
    }

    const currentPackage = await packageService.getPackageById(
      student.packageId._id.toString(),
    );
    const newPackage = await packageService.getPackageByCode(newPackageCode);

    if (newPackage.price >= currentPackage.price) {
      throw new BadRequestError(
        "Can only downgrade to a lower-priced package. Upgrades are not allowed here.",
      );
    }

    logger.info(
      `Downgrading student ${matricNumber} from ${currentPackage.code} (₦${currentPackage.price}) to ${newPackage.code} (₦${newPackage.price}). Current paid: ₦${student.totalPaid}`,
    );

    student.packageId = newPackage._id;
    student.selectedDays = this.resolveSelectedDaysForPackage(
      newPackage.packageType,
      selectedDays,
    );
    student.invites = undefined;

    // Cap totalPaid to the new (lower) package price and recalculate status
    const newTotalPaid = Math.min(student.totalPaid, newPackage.price);
    student.totalPaid = newTotalPaid;

    if (newTotalPaid >= newPackage.price) {
      student.paymentStatus = PaymentStatus.FULLY_PAID;
    } else if (newTotalPaid > 0) {
      student.paymentStatus = PaymentStatus.PARTIALLY_PAID;
    } else {
      student.paymentStatus = PaymentStatus.NOT_PAID;
    }

    return await student.save();
  }

  async updatePaymentStatus(
    studentId: string,
    amount: number,
  ): Promise<IStudent> {
    const student = await this.getStudentById(studentId);
    const pkg = await packageService.getPackageById(
      student.packageId._id.toString(),
    );

    const effectivePrice = getEffectivePrice(student.matricNumber, pkg);

    // Cap the credited amount to effective price (handle overpayment + discounts)
    const newTotalPaid = Math.min(student.totalPaid + amount, effectivePrice);
    student.totalPaid = newTotalPaid;

    // Update payment status
    if (student.totalPaid >= effectivePrice) {
      student.paymentStatus = PaymentStatus.FULLY_PAID;
    } else if (student.totalPaid > 0) {
      student.paymentStatus = PaymentStatus.PARTIALLY_PAID;
    } else {
      student.paymentStatus = PaymentStatus.NOT_PAID;
    }

    logger.info(
      `Updated student ${student.matricNumber} payment: ₦${student.totalPaid} / ₦${effectivePrice} (${student.paymentStatus})`,
    );

    return await student.save();
  }

  async getStudentWithPaymentHistory(id: string) {
    const student = await this.getStudentById(id);
    const payments = await Payment.find({ studentId: id })
      .populate("packageIdAtTime")
      .sort({ createdAt: -1 });

    const pkg = await packageService.getPackageById(
      student.packageId._id.toString(),
    );

    const effectivePrice = getEffectivePrice(student.matricNumber, pkg);

    return {
      student,
      package: pkg,
      payments,
      totalPaid: student.totalPaid,
      outstanding: Math.max(effectivePrice - student.totalPaid, 0),
    };
  }

  async updateInvites(
    studentId: string,
    imageUrl: string,
  ): Promise<IStudent> {
    const student = await this.getStudentById(studentId);

    student.invites = {
      imageUrl,
      generatedAt: new Date(),
    };

    return await student.save();
  }

  async getAllStudents(filters: {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
    packageCode?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, status, packageCode, search } = filters;

    const query: any = {};

    if (status) {
      query.paymentStatus = status;
    }

    if (packageCode) {
      const pkg = await packageService.getPackageByCode(packageCode);
      query.packageId = pkg._id;
    }

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { matricNumber: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [students, total] = await Promise.all([
      Student.find(query)
        .populate("packageId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Student.countDocuments(query),
    ]);

    return {
      students,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export default new StudentService();
