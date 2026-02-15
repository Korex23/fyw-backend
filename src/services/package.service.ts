import Package, { IPackage } from "../models/Package";
import { BadRequestError, NotFoundError } from "../utils/errors";
import mongoose from "mongoose";

export class PackageService {
  async createOrUpdatePackage(
    code: string,
    name: string,
    price: number,
    benefits: string[],
  ): Promise<IPackage> {
    const existingPackage = await Package.findOne({ code });

    if (existingPackage) {
      existingPackage.name = name;
      existingPackage.price = price;
      existingPackage.benefits = benefits;
      return await existingPackage.save();
    }

    return await Package.create({ code, name, price, benefits });
  }

  async getAllPackages(): Promise<IPackage[]> {
    return await Package.find().sort({ price: 1 });
  }

  async getPackageByCode(code: string): Promise<IPackage> {
    const pkg = await Package.findOne({ code: code.toUpperCase() });
    if (!pkg) {
      throw new NotFoundError(`Package with code ${code} not found`);
    }
    return pkg;
  }

  async getPackageById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError("Invalid packageId");
    }

    const pkg = await Package.findById(id);
    if (!pkg) throw new NotFoundError("Package not found");
    return pkg;
  }
}

export default new PackageService();
