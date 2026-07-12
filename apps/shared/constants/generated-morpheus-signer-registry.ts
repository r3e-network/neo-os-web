// Generated from neo-morpheus-oracle/config/signer-identities.json.
// Do not edit manually; re-export from the Morpheus canonical oracle workspace.

export const MORPHEUS_PUBLIC_SIGNER_REGISTRY = {
  "mainnet": {
    "worker": {
      "address": "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32",
      "scriptHash": "0x6d0656f6dd91469db1c90cc1e574380613f43738",
      "publicKey": "038c80a6a7fb694a78cdbf7eb91477cb0f7b6d372a5ca840b554c803fbc89c8769"
    },
    "oracleVerifier": {
      "address": "NeJpGYLkyYBX4WBfLbvSoBnjkCkTPsgtmX",
      "scriptHash": "0x6a662d7450620d1614074a1561887daa2463c4c9",
      "publicKey": "0252183e08434f69693f6496cb9473eb60e8cd790fadecb774c5485440435c7c98"
    }
  },
  "testnet": {
    "worker": {
      "address": "NiUs458jFbTH1DA3b9QyeDhMaD282h3iJg",
      "scriptHash": "0xe421999c396ee0249a8a8c9dd95bfbdaf55f8bf7",
      "publicKey": "02911ea28aee939ef686f42e1137954135998b71e7e997794bde8c0a40f4b95cb4"
    },
    "oracleVerifier": {
      "address": "NiUs458jFbTH1DA3b9QyeDhMaD282h3iJg",
      "scriptHash": "0xe421999c396ee0249a8a8c9dd95bfbdaf55f8bf7",
      "publicKey": "02911ea28aee939ef686f42e1137954135998b71e7e997794bde8c0a40f4b95cb4"
    }
  }
} as const;

export type MorpheusPublicSignerRegistry = typeof MORPHEUS_PUBLIC_SIGNER_REGISTRY;
