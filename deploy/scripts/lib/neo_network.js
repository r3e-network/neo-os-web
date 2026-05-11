"use strict";

const MAINNET_RPC_URL = "https://mainnet2.neo.coz.io:443";
const TESTNET_RPC_URL = "https://testnet1.neo.coz.io:443";
const MAINNET_MAGIC = 860833102;
const TESTNET_MAGIC = 894710606;

const NETWORK_DEFAULTS = {
  mainnet: {
    key: "neo-n3-mainnet",
    rpcUrl: process.env.NEO_RPC_MAINNET || MAINNET_RPC_URL,
    networkMagic: Number(process.env.NEO_MAINNET_MAGIC || MAINNET_MAGIC),
    oracleHash: (
      process.env.MORPHEUS_ORACLE_MAINNET_HASH
      || process.env.CONTRACT_MORPHEUS_ORACLE_MAINNET_HASH
      || "0x5b492098fc094c760402e01f7e0b631b939d2bea"
    ).trim(),
    aaCoreHash: (
      process.env.AA_CORE_HASH_MAINNET
      || process.env.CONTRACT_AA_CORE_MAINNET_HASH
      || "0x0268a387913b250166ddec032b03332690a1ef78"
    ).trim(),
  },
  testnet: {
    key: "neo-n3-testnet",
    rpcUrl: process.env.NEO_RPC_TESTNET || process.env.NEO_RPC_URL || TESTNET_RPC_URL,
    networkMagic: Number(process.env.NEO_TESTNET_MAGIC || process.env.NEO_NETWORK_MAGIC || TESTNET_MAGIC),
    oracleHash: (
      process.env.MORPHEUS_ORACLE_TESTNET_HASH
      || process.env.CONTRACT_MORPHEUS_ORACLE_HASH
      || "0x4b882e94ed766807c4fd728768f972e13008ad52"
    ).trim(),
    aaCoreHash: (
      process.env.AA_CORE_HASH_TESTNET
      || process.env.CONTRACT_AA_CORE_HASH
      || "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2"
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
