/**
 * MiniApp SDK Types (stub)
 */

/** @typedef {Object} MiniAppSDKConfig
 * @property {string} [baseUrl]
 * @property {string} [appId]
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
