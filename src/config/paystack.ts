import axios, { AxiosInstance } from "axios";
import { env } from "./env";

class PaystackClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: "https://api.paystack.co",
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}

export default new PaystackClient().getClient();
