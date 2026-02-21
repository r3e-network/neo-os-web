export interface WalletAccount {
  address: string;
  publicKey: string;
  label?: string;
}

export interface Balance {
  neo: string;
  gas: string;
}

export type WalletProvider = "neoline" | "o3" | "onegate";

export interface WalletState {
  connected: boolean;
  address: string;
  provider: WalletProvider | null;
  balance: Balance | null;
  loading: boolean;
}
