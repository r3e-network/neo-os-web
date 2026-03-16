"use strict";

const MAINNET_RPC_URL = "https://mainnet1.neo.coz.io:443";
const TESTNET_RPC_URL = "https://testnet1.neo.coz.io:443";
const MAINNET_MAGIC = 860833102;
const TESTNET_MAGIC = 894710606;

const NETWORK_DEFAULTS = {
  mainnet: {
    key: "neo-n3-mainnet",
    rpcUrl: process.env.NEO_MAINNET_RPC_URL || process.env.NEO_RPC_MAINNET || MAINNET_RPC_URL,
    networkMagic: Number(process.env.NEO_MAINNET_MAGIC || MAINNET_MAGIC),
    oracleHash: (
      process.env.MORPHEUS_ORACLE_MAINNET_HASH
      || process.env.CONTRACT_MORPHEUS_ORACLE_MAINNET_HASH
      || "0x017520f068fd602082fe5572596185e62a4ad991"
    ).trim(),
    paymentHubHash: (
      process.env.PAYMENT_HUB_MAINNET_HASH
      || process.env.CONTRACT_PAYMENT_HUB_MAINNET_HASH
      || "0x5c389477ce466224f02935dae61e0690846478b2"
    ).trim(),
  },
  testnet: {
    key: "neo-n3-testnet",
    rpcUrl: process.env.NEO_TESTNET_RPC_URL || process.env.NEO_RPC_URL || TESTNET_RPC_URL,
    networkMagic: Number(process.env.NEO_TESTNET_MAGIC || process.env.NEO_NETWORK_MAGIC || TESTNET_MAGIC),
    oracleHash: (
      process.env.MORPHEUS_ORACLE_TESTNET_HASH
      || process.env.CONTRACT_MORPHEUS_ORACLE_HASH
      || "0x4b882e94ed766807c4fd728768f972e13008ad52"
    ).trim(),
    paymentHubHash: (
      process.env.PAYMENT_HUB_TESTNET_HASH
      || process.env.CONTRACT_PAYMENTHUB_HASH
      || "0x340cb33d770b38f26d066716dd1f9df5283d629e"
    ).trim(),
  },
};

function normalizeNetworkName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "mainnet" || normalized === "neo-n3-mainnet") return "mainnet";
  if (normalized === "testnet" || normalized === "neo-n3-testnet") return "testnet";
  return "";
}

function getTargetNetwork(manifest) {
  const override = normalizeNetworkName(process.env.NEO_TARGET_NETWORK || process.env.FLAGSHIP_NETWORK);
  if (override) return override;
  return normalizeNetworkName(manifest?.default_network) || "mainnet";
}

function getNetworkConfig(networkName) {
  return NETWORK_DEFAULTS[normalizeNetworkName(networkName) || "mainnet"];
}

function getManifestContractHash(manifest, networkName) {
  const config = getNetworkConfig(networkName || getTargetNetwork(manifest));
  return String(manifest?.contracts?.[config.key] || "").trim();
}

module.exports = {
  MAINNET_RPC_URL,
  TESTNET_RPC_URL,
  MAINNET_MAGIC,
  TESTNET_MAGIC,
  normalizeNetworkName,
  getTargetNetwork,
  getNetworkConfig,
  getManifestContractHash,
};
