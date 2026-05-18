export interface WalletAccount {
  address: string;
  publicKey: string;
  label?: string;
}

export interface Balance {
  neo: string;
  gas: string;
}

export type WalletProvider = "nep21" | "neoline" | "onegate";

export interface WalletState {
  connected: boolean;
  address: string;
  provider: WalletProvider | null;
  balance: Balance | null;
  loading: boolean;
}
