import { OSServiceProxy } from "./OSServiceProxy";

export class PaymentProxy extends OSServiceProxy {
  protected readonly servicePrefix = "os-payment";

  async deposit(
    amount: string,
    memo?: string,
  ): Promise<{ invocation: unknown }> {
    return this.call("deposit", { amount, memo });
  }

  async withdraw(amount: string): Promise<void> {
    await this.call("withdraw", { amount });
  }

  async getBalance(): Promise<string> {
    return this.call("balance", {});
  }

  async transfer(to: string, amount: string): Promise<void> {
    await this.call("transfer", { to, amount });
  }
}
