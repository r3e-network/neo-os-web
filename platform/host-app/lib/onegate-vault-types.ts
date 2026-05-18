export const ONEGATE_VAULT_MIN_REWARD_FIXED8 = 100000000n;
export const ONEGATE_VAULT_MAX_REWARD_FIXED8 = 5000000000n;

export type OneGateVaultNetwork = "mainnet" | "testnet";
export type OneGateVaultCampaignStatus = "active" | "paused" | "expired";
export type OneGateVaultClaimStatus =
  | "unused"
  | "pending"
  | "submitted"
  | "paid"
  | "failed";

export type OneGateVaultCampaign = {
  id: string;
  appId?: string | null;
  oneGateAppId?: string | null;
  network: OneGateVaultNetwork;
  status: OneGateVaultCampaignStatus;
  minAmountFixed8: string;
  maxAmountFixed8: string;
  remainingAmountFixed8: string;
  maxClaims: number;
  claimedCount: number;
  rewardSource?: string | null;
  expiresAt?: string | null;
};

export type OneGateVaultClaimKey = {
  keyHash: string;
  campaignId: string;
  claimKeyId?: string | null;
  oneGateAppId?: string | null;
  network: OneGateVaultNetwork;
  status: OneGateVaultClaimStatus;
  walletAddress?: string | null;
  amountFixed8?: string | null;
  txHash?: string | null;
  requestId?: string | null;
  errorMessage?: string | null;
};

export type ReservedOneGateVaultClaim = {
  keyHash: string;
  campaignId: string;
  network: OneGateVaultNetwork;
  status: OneGateVaultClaimStatus;
  walletAddress: string;
  amountFixed8: string;
  txHash?: string | null;
  requestId: string;
  rewardSource?: string | null;
};

export type OneGateVaultClaimResult = {
  status: "submitted" | "paid";
  claimKey: string;
  address: string;
  network: OneGateVaultNetwork;
  amount: string;
  amountFixed8: string;
  luckPercent: string;
  txHash: string;
  requestId: string;
};

export type OneGateVaultLaunchIdentity = {
  poolId?: string;
  oneGateAppId?: string;
  appId?: string;
};

export interface OneGateVaultRepository {
  reserveClaim(input: {
    keyHash: string;
    address: string;
    network: OneGateVaultNetwork;
    requestId: string;
    randomInt: (min: bigint, max: bigint) => bigint;
  } & OneGateVaultLaunchIdentity): Promise<ReservedOneGateVaultClaim>;
  markSubmitted(input: {
    keyHash: string;
    network: OneGateVaultNetwork;
    txHash: string;
    requestId: string;
  }): Promise<void>;
  markPaid(input: {
    keyHash: string;
    network: OneGateVaultNetwork;
    txHash: string;
    requestId: string;
  }): Promise<void>;
  markFailed(input: {
    keyHash: string;
    network: OneGateVaultNetwork;
    requestId: string;
    errorMessage: string;
  }): Promise<void>;
  getClaimStatus(input: {
    keyHash: string;
    address?: string;
    network: OneGateVaultNetwork;
  } & OneGateVaultLaunchIdentity): Promise<ReservedOneGateVaultClaim | null>;
}

export interface OneGateVaultPaymentService {
  sendGas(input: {
    requestId: string;
    network: OneGateVaultNetwork;
    toAddress: string;
    amountFixed8: string;
    rewardSource?: string | null;
  }): Promise<{ txHash: string; status: "submitted" | "paid" }>;
}

export type OneGateVaultPayoutCheck = {
  ok: boolean;
  reason?: string;
};

export class OneGateVaultError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OneGateVaultError";
    this.code = code;
  }
}
