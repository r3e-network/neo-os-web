import { WalletAdapter, WalletAccount, WalletBalance, SignedMessage, InvokeParams, TransactionResult } from "./base";
import { rpcCall, getChainRpcUrl } from "../../chain/rpc-client";
import type { ChainId } from "../../chains/types";
import { isNeoN3Chain } from "../../chains/types";
import { getNeoContract, getGasContract, getChainRegistry } from "../../chains/registry";
import { decryptPrivateKeyBrowser } from "../crypto-browser";
import { wallet, u, sc, tx, rpc } from "@cityofzion/neon-js";

export class Auth0Adapter implements WalletAdapter {
  readonly name = "Social Account";
  readonly icon = "/auth0-logo.svg";
  readonly downloadUrl = "";
  readonly supportedChainTypes = ["neo-n3"] as const;

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

  async getBalance(address: string, chainId: ChainId): Promise<WalletBalance> {
    try {
      const gasHash = getGasContract(chainId);
      const neoHash = getNeoContract(chainId);

      const response = await rpcCall<{ balance: { assethash: string; amount: string }[] }>(
        "getnep17balances",
        [address],
        chainId,
      );

      const balances = response?.balance || [];
      const gas = balances.find((b) => b.assethash === gasHash)?.amount || "0";
      const neo = balances.find((b) => b.assethash === neoHash)?.amount || "0";

      const gasVal = (parseInt(gas) / 100000000).toString();
      const neoVal = neo;

      return {
        native: gasVal,
        nativeSymbol: "GAS",
        governance: neoVal,
        governanceSymbol: "NEO",
      };
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      return { native: "0", nativeSymbol: "GAS", governance: "0", governanceSymbol: "NEO" };
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
  async invokeWithPassword(params: InvokeParams, password: string, chainId: ChainId): Promise<TransactionResult> {
    const account = await this.getDecryptedAccount(password);

    // Build script from params
    const script = sc.createScript({
      scriptHash: params.scriptHash,
      operation: params.operation,
      args: params.args?.map((arg) => this.convertArg(arg)) || [],
    });

    // Get RPC endpoint from chain registry
    const rpcEndpoint = getChainRpcUrl(chainId);

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

    // Sign transaction - get network magic from chain registry
    const registry = getChainRegistry();
    const chainConfig = registry.getChain(chainId);
    if (!chainConfig || !isNeoN3Chain(chainConfig)) {
      throw new Error(`Auth0 adapter only supports Neo N3 chains. Got: ${chainId}`);
    }
    const networkMagic = chainConfig.networkMagic;
    transaction.sign(account, networkMagic);

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
