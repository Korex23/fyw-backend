import { Router } from "express";
import studentController, {
  createStudentSchema,
  selectPackageSchema,
  upgradePackageSchema,
  downgradePackageSchema,
  getStudentSchema,
} from "../controllers/student.controller";
import { validate } from "../middlewares/validation.middleware";

const router = Router();

// Get all packages
router.get(
  "/packages",
  studentController.getAllPackages.bind(studentController),
);

// Create or identify student
router.post(
  "/identify",
  validate(createStudentSchema),
  studentController.createOrIdentifyStudent.bind(studentController),
);

// Get student by matric number
router.get(
  "/:matricNumber",
  validate(getStudentSchema),
  studentController.getStudentByMatric.bind(studentController),
);

// Select package
router.post(
  "/select-package",
  validate(selectPackageSchema),
  studentController.selectPackage.bind(studentController),
);

// Upgrade package
router.post(
  "/upgrade-package",
  validate(upgradePackageSchema),
  studentController.upgradePackage.bind(studentController),
);

// Downgrade package (only allowed when payment is not complete)
router.post(
  "/downgrade-package",
  validate(downgradePackageSchema),
  studentController.downgradePackage.bind(studentController),
);

export default router;
