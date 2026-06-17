/**
 * External-consumer type fixture.
 *
 * This module imports the SDK exactly as a downstream miniapp would — through
 * the published package specifier `@neo-miniapp/sdk`, which the sibling
 * tsconfig maps to the emitted `dist/index.d.ts` (the file the package.json
 * `types` field advertises). It is type-checked, never run.
 *
 * `npm run typecheck` only proves the *source* compiles; it never compiles the
 * emitted declarations the way a consumer resolves them. If a refactor drops a
 * public export, renames a public type, or emits a malformed declaration, this
 * fixture stops compiling and `npm run types:check` fails — so the shipped type
 * surface cannot silently rot.
 */
import {
  AdminSDK,
  createAdminSDK,
  createHostSDK,
  createMiniAppSDK,
  extractNep21ProviderFromReadyEvent,
  HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS,
  HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
  installMiniAppSDK,
  isCompatibleBridgeProtocolVersion,
  isNep21Provider,
  normalizeBridgeProtocolVersion,
  readImmediateNep21Provider,
  rememberNep21Provider,
  requestNep21Provider,
  resetNep21ProviderCacheForTests,
  SDKError,
  waitForNep21Provider,
} from "@neo-miniapp/sdk";
import type {
  AdminSDKConfig,
  AnalyticsResponse,
  AppRegisterResponse,
  AppUpdateManifestResponse,
  APIKeyCreateResponse,
  APIKeyMeta,
  APIKeyRevokeResponse,
  APIKeysListResponse,
  AutomationDeleteResponse,
  AutomationExecution,
  AutomationStatusResponse,
  AutomationTrigger,
  AutomationTriggerRequest,
  ChainTransaction,
  ComputeExecuteRequest,
  ComputeJob,
  ContractEvent,
  ContractParam,
  EventsListParams,
  EventsListResponse,
  GasBankAccount,
  GasBankAccountResponse,
  GasBankDeposit,
  GasBankDepositCreateResponse,
  GasBankDepositsResponse,
  GasBankDepositStatus,
  GasBankTransaction,
  GasBankTransactionsResponse,
  GasBankTransactionType,
  HostSDK,
  InvocationIntent,
  MiniAppListResponse,
  MiniAppSDK,
  MiniAppSDKConfig,
  MiniAppUsage,
  MiniAppUsageResponse,
  NeoDapiAccount,
  NeoDapiAuthenticationResponse,
  NeoDapiEventName,
  NeoDapiInvocation,
  NeoDapiProvider,
  Nep21ProviderPreference,
  Nep21Window,
  OracleQueryRequest,
  OracleQueryResponse,
  PayGASResponse,
  PriceResponse,
  RNGResponse,
  SecretMeta,
  SecretsDeleteResponse,
  SecretsGetResponse,
  SecretsListResponse,
  SecretsPermissionsResponse,
  SecretsUpsertResponse,
  ServiceHealthResponse,
  SignedMessage,
  TransactionsListParams,
  TransactionsListResponse,
  UserListResponse,
  VoteBNEOResponse,
  VoteNEOResponse,
  WalletBindResponse,
  WalletNonceResponse,
  WalletProviderInfo,
  WalletProviderKind,
} from "@neo-miniapp/sdk";

// Exercise the value exports so a dropped/renamed export is a compile error.
const usedValues: unknown[] = [
  createMiniAppSDK,
  createHostSDK,
  createAdminSDK,
  AdminSDK,
  SDKError,
  installMiniAppSDK,
  extractNep21ProviderFromReadyEvent,
  isNep21Provider,
  readImmediateNep21Provider,
  rememberNep21Provider,
  requestNep21Provider,
  resetNep21ProviderCacheForTests,
  waitForNep21Provider,
  isCompatibleBridgeProtocolVersion,
  normalizeBridgeProtocolVersion,
];
void usedValues;

// Protocol constants keep their primitive shapes.
const protocolVersion: number = HOST_WALLET_BRIDGE_PROTOCOL_VERSION;
const compatibleVersions: readonly number[] =
  HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS;
void protocolVersion;
void compatibleVersions;

// Core factory + config contract.
const config: MiniAppSDKConfig = {} as MiniAppSDKConfig;
const miniApp: MiniAppSDK = createMiniAppSDK(config);
const host: HostSDK = createHostSDK(config);
const adminConfig: AdminSDKConfig = {} as AdminSDKConfig;
const admin: AdminSDK = createAdminSDK(adminConfig);
void miniApp;
void host;
void admin;

// NEP-21 provider / host wallet bridge contract.
const preference: Nep21ProviderPreference = "onegate";
const provider: NeoDapiProvider | null = readImmediateNep21Provider({ preference });
const accountsPromise: Promise<NeoDapiAccount[]> | undefined = provider?.getAccounts();
void accountsPromise;
const bridgePromise: Promise<NeoDapiProvider> = waitForNep21Provider({ preference });
void bridgePromise;
const dapiWindow: Nep21Window = window as Nep21Window;
void dapiWindow;

// Narrowing through the type guard must yield the public provider type.
function narrow(value: unknown): NeoDapiProvider | undefined {
  return isNep21Provider(value) ? value : undefined;
}
void narrow;

// Touch the remaining exported type aliases so they cannot be dropped silently.
type SurfaceProbe = [
  ContractParam,
  InvocationIntent,
  SignedMessage,
  WalletProviderInfo,
  WalletProviderKind,
  MiniAppUsage,
  MiniAppUsageResponse,
  NeoDapiAuthenticationResponse,
  NeoDapiEventName,
  NeoDapiInvocation,
  ServiceHealthResponse,
  MiniAppListResponse,
  UserListResponse,
  AnalyticsResponse,
  PayGASResponse,
  VoteBNEOResponse,
  VoteNEOResponse,
  RNGResponse,
  PriceResponse,
  AppRegisterResponse,
  AppUpdateManifestResponse,
  WalletNonceResponse,
  WalletBindResponse,
  SecretMeta,
  SecretsListResponse,
  SecretsGetResponse,
  SecretsUpsertResponse,
  SecretsDeleteResponse,
  SecretsPermissionsResponse,
  APIKeyMeta,
  APIKeysListResponse,
  APIKeyCreateResponse,
  APIKeyRevokeResponse,
  GasBankAccount,
  GasBankDepositStatus,
  GasBankDeposit,
  GasBankTransactionType,
  GasBankTransaction,
  GasBankAccountResponse,
  GasBankDepositsResponse,
  GasBankTransactionsResponse,
  GasBankDepositCreateResponse,
  OracleQueryRequest,
  OracleQueryResponse,
  ComputeExecuteRequest,
  ComputeJob,
  AutomationTriggerRequest,
  AutomationTrigger,
  AutomationExecution,
  AutomationDeleteResponse,
  AutomationStatusResponse,
  ContractEvent,
  EventsListParams,
  EventsListResponse,
  ChainTransaction,
  TransactionsListParams,
  TransactionsListResponse,
];
declare const surfaceProbe: SurfaceProbe;
void surfaceProbe;
