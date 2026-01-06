import { WalletAdapter, WalletAccount, WalletBalance, SignedMessage, InvokeParams, TransactionResult } from "./base";
import { rpcCall, Network } from "../../chain/rpc-client";
import { decryptPrivateKeyBrowser } from "../crypto-browser";
import { wallet, u, sc, tx, rpc } from "@cityofzion/neon-js";

const NEO_GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

export class Auth0Adapter implements WalletAdapter {
  readonly name = "Social Account";
  readonly icon = "/auth0-logo.svg";
  readonly downloadUrl = "";

  isInstalled(): boolean {
    return true;
  }

  async connect(): Promise<WalletAccount> {
    try {
      const res = await fetch("/api/auth/neo-account");
      if (!res.ok) {
        throw new Error("Failed to fetch social account");
      }
      const data = await res.json();
      return {
        address: data.address,
        publicKey: data.publicKey,
        label: "Social Account",
      };
    } catch (error) {
      console.error("Auth0 wallet connection error:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // No-op
  }

  async getBalance(address: string): Promise<WalletBalance> {
    try {
      const network = (process.env.NEXT_PUBLIC_NEO_NETWORK as "mainnet" | "testnet") || "testnet";
      const response = await rpcCall<{ balance: { assethash: string; amount: string }[] }>(
        "getnep17balances",
        [address],
        network,
      );

      const balances = response?.balance || [];
      const gas = balances.find((b) => b.assethash === NEO_GAS_HASH)?.amount || "0";
      const neo = balances.find((b) => b.assethash === NEO_NEO_HASH)?.amount || "0";

      const gasVal = (parseInt(gas) / 100000000).toString();
      const neoVal = neo;

      return {
        gas: gasVal,
        neo: neoVal,
      };
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      return { neo: "0", gas: "0" };
    }
  }

  async signMessage(message: string): Promise<SignedMessage> {
    throw new Error("Password required for social account signing");
  }

  async invoke(params: InvokeParams): Promise<TransactionResult> {
    throw new Error("Password required for social account transactions");
  }

  /**
   * Sign message with password (specific to Auth0 adapter)
   */
  async signWithPassword(message: string, password: string): Promise<SignedMessage> {
    const account = await this.getDecryptedAccount(password);

    // Use ab2hexstring because generateRandomArray returns a typed array/buffer
    const salt = u.ab2hexstring(u.generateRandomArray(16));
    const parameterHexString = u.str2hexstring(message);
    const lengthHex = (parameterHexString.length / 2).toString(16).padStart(2, "0");

    // Construct standard Neo message structure: 0x010001f0 + length + msg + salt
    const concatenatedString = "010001f0" + lengthHex + parameterHexString + salt;

    // Fix: u.hexstring2str
    const serializedTransaction = u.hexstring2str(concatenatedString);

    const data = wallet.sign(serializedTransaction, account.privateKey);

    return {
      publicKey: account.publicKey,
      data,
      salt,
      message,
    };
  }

  /**
   * Invoke transaction with password
   */
  async invokeWithPassword(params: InvokeParams, password: string): Promise<TransactionResult> {
    const account = await this.getDecryptedAccount(password);
    const network = (process.env.NEXT_PUBLIC_NEO_NETWORK as Network) || "testnet";

    // Build script from params
    const script = sc.createScript({
      scriptHash: params.scriptHash,
      operation: params.operation,
      args: params.args?.map((arg) => this.convertArg(arg)) || [],
    });

    // Get network magic and current block
    const rpcEndpoint = network === "mainnet" ? "https://mainnet1.neo.coz.io:443" : "https://testnet1.neo.coz.io:443";

    const rpcClient = new rpc.RPCClient(rpcEndpoint);
    const currentHeight = await rpcClient.getBlockCount();

    // Build transaction
    const transaction = new tx.Transaction({
      signers: [
        {
          account: wallet.getScriptHashFromAddress(account.address),
          scopes: tx.WitnessScope.CalledByEntry,
        },
      ],
      validUntilBlock: currentHeight + 100,
      script,
    });

    // Calculate network fee
    const feeData = await rpcClient.invokeScript(u.HexString.fromHex(script), [
      {
        account: wallet.getScriptHashFromAddress(account.address),
        scopes: tx.WitnessScope.CalledByEntry.toString(),
      },
    ]);

    if (feeData.state === "FAULT") {
      throw new Error(`Script execution failed: ${feeData.exception || "Unknown error"}`);
    }

    // Set fees
    transaction.systemFee = u.BigInteger.fromNumber(feeData.gasconsumed);
    transaction.networkFee = u.BigInteger.fromNumber(1000000); // 0.01 GAS base fee

    // Sign transaction
    transaction.sign(account, network === "mainnet" ? 860833102 : 894710606);

    // Send transaction
    const txid = await rpcClient.sendRawTransaction(transaction.serialize(true));

    return {
      txid,
      nodeUrl: rpcEndpoint,
    };
  }

  /**
   * Convert argument to ContractParam
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private convertArg(arg: any): any {
    if (typeof arg === "string") {
      if (arg.startsWith("0x") && arg.length === 42) {
        return sc.ContractParam.hash160(arg);
      }
      return sc.ContractParam.string(arg);
    }
    if (typeof arg === "number") {
      return sc.ContractParam.integer(arg);
    }
    if (typeof arg === "boolean") {
      return sc.ContractParam.boolean(arg);
    }
    if (Array.isArray(arg)) {
      return sc.ContractParam.array(...arg.map((a) => this.convertArg(a)));
    }
    return sc.ContractParam.any(arg);
  }

  private async getDecryptedAccount(password: string): Promise<any> {
    const res = await fetch("/api/auth/neo-account");
    if (!res.ok) throw new Error("Failed to fetch account data");

    const data = await res.json();
    if (!data.encryptedKey) throw new Error("Account data missing encryption info");

    const { encryptedData, salt, iv, tag, iterations } = data.encryptedKey;

    const privateKey = await decryptPrivateKeyBrowser(encryptedData, password, salt, iv, tag, iterations);

    return new wallet.Account(privateKey);
  }
}
