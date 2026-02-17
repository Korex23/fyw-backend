/* eslint-disable @typescript-eslint/no-var-requires */
import { env } from "./env";
const Flutterwave = require("flutterwave-node-v3");

const flutterwave = new Flutterwave(
  env.FLUTTERWAVE_PUBLIC_KEY,
  env.FLUTTERWAVE_SECRET_KEY,
);

export default flutterwave;
