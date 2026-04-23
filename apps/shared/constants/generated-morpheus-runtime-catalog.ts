/* eslint-disable */
// Generated from neo-morpheus-oracle/apps/web/public/morpheus-runtime-catalog.json.
// Do not edit manually.

export const MORPHEUS_RUNTIME_CATALOG = {
  "envelope": {
    "version": "2026-04-tee-v1"
  },
  "topology": {
    "ingressPlane": "edge_gateway",
    "orchestrationPlane": "control_plane",
    "schedulerPlane": "control_plane",
    "executionPlane": "tee_runtime",
    "riskPlane": "independent_observer"
  },
  "risk": {
    "observer": "independent_observer",
    "actions": [
      "observe",
      "review",
      "pause_scope"
    ]
  },
  "automation": {
    "workflowId": "automation.upkeep",
    "triggerKinds": [
      "interval",
      "threshold"
    ],
    "route": "/automation/execute",
    "deliveryMode": "onchain_callback"
  },
  "networks": {
    "mainnet": {
      "network": "mainnet",
      "rpcUrl": "https://mainnet1.neo.coz.io:443",
      "networkMagic": 860833102,
      "morpheus": {
        "publicApiUrl": "https://oracle.meshmini.app/mainnet",
        "publicApiUrls": [
          "https://oracle.meshmini.app/mainnet"
        ],
        "runtimeUrl": "https://oracle.meshmini.app/mainnet",
        "runtimeUrls": [
          "https://oracle.meshmini.app/mainnet",
          "https://edge.meshmini.app/mainnet"
        ],
        "edgeUrl": "https://edge.meshmini.app/mainnet",
        "controlPlaneBaseUrl": "https://control.meshmini.app",
        "controlPlaneUrl": "https://control.meshmini.app/mainnet",
        "oracleCvmId": "ddff154546fe22d15b65667156dd4b7c611e6093",
        "oracleCvmName": "oracle-morpheus-neo-r3e",
        "oracleAttestationExplorerUrl": "https://cloud.phala.com/explorer/app_ddff154546fe22d15b65667156dd4b7c611e6093",
        "datafeedCvmId": "ac5b6886a2832df36e479294206611652400178f",
        "datafeedCvmName": "datafeed-morpheus-neo-r3e",
        "datafeedAttestationExplorerUrl": "https://cloud.phala.com/explorer/app_ac5b6886a2832df36e479294206611652400178f",
        "neoDidServiceDid": "did:morpheus:neo_n3:service:neodid"
      },
      "contracts": {
        "aaCore": "0x9742b4ed62a84a886f404d36149da6147528ee33",
        "aaWeb3AuthVerifier": "0xb4107cb2cb4bace0ebe15bc4842890734abe133a",
        "aaSessionKeyVerifier": "0xe82b9d056c011819ff3652427682224daad0cd1f",
        "aaSocialRecoveryVerifier": "0x51ef9639deb29284cc8577a7fa3fdfbc92ada7c3",
        "morpheusOracle": "0x017520f068fd602082fe5572596185e62a4ad991",
        "oracleCallbackConsumer": "0xe1226268f2fe08bea67fb29e1c8fda0d7c8e9844",
        "morpheusDatafeed": "0x03013f49c42a14546c8bbe58f9d434c3517fccab",
        "morpheusNeoDid": "0xb81f31ea81e279793b30411b82c2e82078b63105"
      },
      "domains": {
        "aa": "smartwallet.neo",
        "aaAlias": "aa.morpheus.neo",
        "aaCore": "core.smartwallet.neo",
        "aaWeb3AuthVerifier": "web3auth.smartwallet.neo",
        "aaSessionKeyVerifier": "sessionkey.smartwallet.neo",
        "aaSocialRecoveryVerifier": "recovery.smartwallet.neo",
        "oracle": "oracle.morpheus.neo",
        "datafeed": "pricefeed.morpheus.neo",
        "neodid": "neodid.morpheus.neo"
      }
    },
    "testnet": {
      "network": "testnet",
      "rpcUrl": "https://testnet1.neo.coz.io:443",
      "networkMagic": 894710606,
      "morpheus": {
        "publicApiUrl": "https://oracle.meshmini.app/testnet",
        "publicApiUrls": [
          "https://oracle.meshmini.app/testnet"
        ],
        "runtimeUrl": "https://oracle.meshmini.app/testnet",
        "runtimeUrls": [
          "https://oracle.meshmini.app/testnet",
          "https://edge.meshmini.app/testnet"
        ],
        "edgeUrl": "https://edge.meshmini.app/testnet",
        "controlPlaneBaseUrl": "https://control.meshmini.app",
        "controlPlaneUrl": "https://control.meshmini.app/testnet",
        "oracleCvmId": "ddff154546fe22d15b65667156dd4b7c611e6093",
        "oracleCvmName": "oracle-morpheus-neo-r3e",
        "oracleAttestationExplorerUrl": "https://cloud.phala.com/explorer/app_ddff154546fe22d15b65667156dd4b7c611e6093",
        "datafeedCvmId": "ac5b6886a2832df36e479294206611652400178f",
        "datafeedCvmName": "datafeed-morpheus-neo-r3e",
        "datafeedAttestationExplorerUrl": "https://cloud.phala.com/explorer/app_ac5b6886a2832df36e479294206611652400178f",
        "neoDidServiceDid": "did:morpheus:neo_n3:service:neodid"
      },
      "contracts": {
        "aaCore": "0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38",
        "aaWeb3AuthVerifier": "0xf2560a0db44bbb32d0a6919cf90a3d0643ad8e3d",
        "aaSessionKeyVerifier": "0xed44c88535650b4dd6b8d59776e6ed045462cab6",
        "aaSocialRecoveryVerifier": "",
        "morpheusOracle": "0x4b882e94ed766807c4fd728768f972e13008ad52",
        "oracleCallbackConsumer": "0x8c506f224d82e67200f20d9d5361f767f0756e3b",
        "morpheusDatafeed": "0x9bea75cf702f6afc09125aa6d22f082bfd2ee064",
        "morpheusNeoDid": ""
      },
      "domains": {
        "aa": "",
        "aaAlias": "",
        "aaCore": "",
        "aaWeb3AuthVerifier": "",
        "aaSessionKeyVerifier": "",
        "aaSocialRecoveryVerifier": "",
        "oracle": "",
        "datafeed": "",
        "neodid": ""
      }
    }
  },
  "workflows": [
    {
      "id": "oracle.query",
      "version": 1,
      "trigger": {
        "kind": "request"
      },
      "allowedNetworks": [
        "mainnet",
        "testnet"
      ],
      "route": "/oracle/query",
      "capabilityId": "oracle_query",
      "policies": [
        "tenant",
        "provider",
        "risk"
      ],
      "execution": {
        "orchestrationPlane": "control_plane",
        "executionPlane": "tee_runtime",
        "riskPlane": "independent_observer",
        "teeRequired": true
      },
      "delivery": {
        "mode": "api_response"
      }
    },
    {
      "id": "oracle.smart_fetch",
      "version": 1,
      "trigger": {
        "kind": "request"
      },
      "allowedNetworks": [
        "mainnet",
        "testnet"
      ],
      "route": "/oracle/smart-fetch",
      "capabilityId": "oracle_smart_fetch",
      "policies": [
        "tenant",
        "provider",
        "risk"
      ],
      "execution": {
        "orchestrationPlane": "control_plane",
        "executionPlane": "tee_runtime",
        "riskPlane": "independent_observer",
        "teeRequired": true
      },
      "delivery": {
        "mode": "api_response"
      }
    },
    {
      "id": "feed.sync",
      "version": 1,
      "trigger": {
        "kind": "event",
        "supported": [
          "feed_tick"
        ]
      },
      "allowedNetworks": [
        "mainnet",
        "testnet"
      ],
      "route": "/feeds/tick",
      "capabilityId": "oracle_feed",
      "policies": [
        "provider",
        "risk"
      ],
      "execution": {
        "orchestrationPlane": "control_plane",
        "executionPlane": "tee_runtime",
        "riskPlane": "independent_observer",
        "teeRequired": true
      },
      "delivery": {
        "mode": "shared_resource_sync"
      }
    },
    {
      "id": "automation.upkeep",
      "version": 1,
      "trigger": {
        "kind": "scheduler",
        "supported": [
          "interval",
          "threshold"
        ]
      },
      "allowedNetworks": [
        "mainnet",
        "testnet"
      ],
      "route": "/automation/execute",
      "policies": [
        "tenant",
        "provider",
        "paymaster",
        "risk"
      ],
      "execution": {
        "orchestrationPlane": "control_plane",
        "executionPlane": "tee_runtime",
        "riskPlane": "independent_observer",
        "teeRequired": true
      },
      "delivery": {
        "mode": "onchain_callback"
      }
    },
    {
      "id": "compute.execute",
      "version": 1,
      "trigger": {
        "kind": "request"
      },
      "allowedNetworks": [
        "mainnet",
        "testnet"
      ],
      "route": "/compute/execute",
      "capabilityId": "compute_execute",
      "policies": [
        "tenant",
        "risk"
      ],
      "execution": {
        "orchestrationPlane": "control_plane",
        "executionPlane": "tee_runtime",
        "riskPlane": "independent_observer",
        "teeRequired": true
      },
      "delivery": {
        "mode": "api_response"
      }
    },
    {
      "id": "neodid.bind",
      "version": 1,
      "trigger": {
        "kind": "request"
      },
      "allowedNetworks": [
        "mainnet",
        "testnet"
      ],
      "route": "/neodid/bind",
      "capabilityId": "neodid_bind",
      "policies": [
        "tenant",
        "risk"
      ],
      "execution": {
        "orchestrationPlane": "control_plane",
        "executionPlane": "tee_runtime",
        "riskPlane": "independent_observer",
        "teeRequired": true
      },
      "delivery": {
        "mode": "kernel_inbox"
      }
    },
    {
      "id": "neodid.action_ticket",
      "version": 1,
      "trigger": {
        "kind": "request"
      },
      "allowedNetworks": [
        "mainnet",
        "testnet"
      ],
      "route": "/neodid/action-ticket",
      "capabilityId": "neodid_action_ticket",
      "policies": [
        "tenant",
        "risk"
      ],
      "execution": {
        "orchestrationPlane": "control_plane",
        "executionPlane": "tee_runtime",
        "riskPlane": "independent_observer",
        "teeRequired": true
      },
      "delivery": {
        "mode": "kernel_inbox"
      }
    },
    {
      "id": "neodid.recovery_ticket",
      "version": 1,
      "trigger": {
        "kind": "request"
      },
      "allowedNetworks": [
        "mainnet",
        "testnet"
      ],
      "route": "/neodid/recovery-ticket",
      "capabilityId": "neodid_recovery_ticket",
      "policies": [
        "tenant",
        "risk"
      ],
      "execution": {
        "orchestrationPlane": "control_plane",
        "executionPlane": "tee_runtime",
        "riskPlane": "independent_observer",
        "teeRequired": true
      },
      "delivery": {
        "mode": "kernel_inbox"
      }
    },
    {
      "id": "paymaster.authorize",
      "version": 1,
      "trigger": {
        "kind": "request"
      },
      "allowedNetworks": [
        "mainnet",
        "testnet"
      ],
      "route": "/paymaster/authorize",
      "capabilityId": "paymaster_authorize",
      "policies": [
        "tenant",
        "paymaster",
        "risk"
      ],
      "execution": {
        "orchestrationPlane": "control_plane",
        "executionPlane": "tee_runtime",
        "riskPlane": "independent_observer",
        "teeRequired": true
      },
      "delivery": {
        "mode": "api_response"
      }
    }
  ]
};
