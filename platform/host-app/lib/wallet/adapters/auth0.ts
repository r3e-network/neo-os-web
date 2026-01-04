import { WalletAdapter, WalletAccount, WalletBalance, SignedMessage, InvokeParams, TransactionResult } from "./base";
import { rpcCall, StackItem } from "../../chain/rpc-client";

const NEO_GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

export class Auth0Adapter implements WalletAdapter {
    readonly name = "Social Account";
    readonly icon = "/auth0-logo.svg"; // Placeholder
    readonly downloadUrl = "";

    isInstalled(): boolean {
        return true; // Cloud wallet is always "installed"
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
        // No-op purely for adapter interface; actual logout handled by Auth0
    }

    async getBalance(address: string): Promise<WalletBalance> {
        try {
            // Use RPC to get balances. Defaulting to testnet/mainnet based on environment or rpc-client default
            const network = process.env.NEXT_PUBLIC_NEO_NETWORK as "mainnet" | "testnet" || "testnet";
            const response = await rpcCall<{ balance: { assethash: string; amount: string }[] }>(
                "getnep17balances",
                [address],
                network
            );

            const balances = response?.balance || [];
            const gas = balances.find((b) => b.assethash === NEO_GAS_HASH)?.amount || "0";
            const neo = balances.find((b) => b.assethash === NEO_NEO_HASH)?.amount || "0";

            // Amounts from RPC might be raw integers?
            // getnep17balances returns actual string values if handled by N3 RPC?
            // Actually standard N3 RPC returns amount as string integer. GAS has 8 decimals. NEO has 0.
            // We need to format them.

            // But base.ts WalletBalance implies string representation. 
            // Most adapters return formatted string? Let's check neoline.ts.

            // Actually, standard RPC returns raw amount. 
            // GAS needs / 1e8.

            const gasVal = (parseInt(gas) / 100000000).toString();
            const neoVal = neo; // NEO is indivisible in standard representation logic usually, but here we keep string

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
        throw new Error("Signing not supported for social accounts yet.");
    }

    async invoke(params: InvokeParams): Promise<TransactionResult> {
        throw new Error("Transactions not supported for social accounts yet.");
    }
}
