import { Interface, parseEther, formatEther } from "https://esm.sh/ethers@6.12.1";

// ============================================================================
// App Registry ABI
// ============================================================================

const APP_REGISTRY_ABI = [
  "function registerApp(string appId, bytes manifestHash, string entryUrl, bytes developerPubKey, bytes contractAddress, string name, string description, string icon, string banner, string category)",
  "function updateApp(string appId, bytes manifestHash, string entryUrl, bytes contractAddress, string name, string description, string icon, string banner, string category)",
];

const appRegistryInterface = new Interface(APP_REGISTRY_ABI);

export function encodeAppRegistryCall(method: "registerApp" | "updateApp", args: unknown[]): string {
  return appRegistryInterface.encodeFunctionData(method, args);
}

// ============================================================================
// Payment Hub ABI (EVM)
// ============================================================================

const PAYMENT_HUB_ABI = [
  "function payApp(string appId) payable",
  "function payAppWithMemo(string appId, string memo) payable",
  "function getAppBalance(string appId) view returns (uint256)",
  "function withdraw(string appId, uint256 amount)",
  "event PaymentReceived(string indexed appId, address indexed payer, uint256 amount, string memo)",
];

const paymentHubInterface = new Interface(PAYMENT_HUB_ABI);

export function encodePayAppCall(appId: string, memo?: string): string {
  if (memo) {
    return paymentHubInterface.encodeFunctionData("payAppWithMemo", [appId, memo]);
  }
  return paymentHubInterface.encodeFunctionData("payApp", [appId]);
}

export function encodeGetAppBalanceCall(appId: string): string {
  return paymentHubInterface.encodeFunctionData("getAppBalance", [appId]);
}

// ============================================================================
// VRF Coordinator ABI (Chainlink-compatible)
// ============================================================================

const VRF_COORDINATOR_ABI = [
  "function requestRandomWords(bytes32 keyHash, uint64 subId, uint16 minConfirmations, uint32 callbackGasLimit, uint32 numWords) returns (uint256 requestId)",
  "event RandomWordsFulfilled(uint256 indexed requestId, uint256[] randomWords)",
];

const vrfCoordinatorInterface = new Interface(VRF_COORDINATOR_ABI);

export function encodeVRFRequest(
  keyHash: string,
  subId: bigint,
  minConfirmations: number,
  callbackGasLimit: number,
  numWords: number,
): string {
  return vrfCoordinatorInterface.encodeFunctionData("requestRandomWords", [
    keyHash,
    subId,
    minConfirmations,
    callbackGasLimit,
    numWords,
  ]);
}

// ============================================================================
// Utility Functions
// ============================================================================

export function parseEtherAmount(amount: string): bigint {
  return parseEther(amount);
}

export function formatEtherAmount(wei: bigint): string {
  return formatEther(wei);
}

export type EVMInvocation = {
  chain_id: string;
  chain_type: "evm";
  contract_address: string;
  data: string;
  value?: string;
  gas?: string;
};

export function buildEVMPaymentInvocation(
  chainId: string,
  paymentHubAddress: string,
  appId: string,
  amountWei: string,
  memo?: string,
): EVMInvocation {
  return {
    chain_id: chainId,
    chain_type: "evm",
    contract_address: paymentHubAddress,
    data: encodePayAppCall(appId, memo),
    value: amountWei,
  };
}

export function buildNativeTransferInvocation(chainId: string, toAddress: string, amountWei: string): EVMInvocation {
  return {
    chain_id: chainId,
    chain_type: "evm",
    contract_address: toAddress,
    data: "0x",
    value: amountWei,
  };
}
