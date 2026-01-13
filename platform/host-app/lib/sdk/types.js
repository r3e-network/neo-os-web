/**
 * MiniApp SDK Types (stub)
 */

/** @typedef {import('../chains/types').ChainId} ChainId */

/** @typedef {Object} MiniAppSDKConfig
 * @property {string} [edgeBaseUrl]
 * @property {string} [appId]
 * @property {"testnet"|"mainnet"} [network] - @deprecated Use chainId instead
 * @property {ChainId|null} [chainId] - Multi-chain support, null if app has no chain support
 * @property {"neo-n3"|"evm"} [chainType]
 * @property {string|null} [contractAddress]
 * @property {ChainId[]} [supportedChains]
 * @property {Record<ChainId, {address: string|null, active?: boolean, entryUrl?: string}>} [chainContracts]
 * @property {() => Promise<string|undefined>} [getAuthToken]
 * @property {() => Promise<string|undefined>} [getAPIKey]
 */

/** @typedef {Object} MiniAppSDK
 * @property {Function} [getAddress]
 * @property {Object} [wallet]
 * @property {Object} [payments]
 * @property {Object} [governance]
 * @property {Object} [rng]
 * @property {Object} [datafeed]
 * @property {Object} [stats]
 * @property {Object} [events]
 * @property {Object} [transactions]
 */

export {};
