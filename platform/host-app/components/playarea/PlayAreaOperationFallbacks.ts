import type { OperationEntry, OperationParam } from "@/components/types";
import {
  EXTERNAL_INTEGRATIONS,
  MINIAPP_CONTRACTS,
  resolveNeoNetwork,
} from "../../../../apps/shared/constants/rpc";

import { PROFILED_PLAYAREAS, type ProfileField } from "./PlayAreaProfiles";

function buildAARelayPayloadDefault(network: ReturnType<typeof resolveNeoNetwork>) {
  return JSON.stringify(
    {
      metaInvocation: {
        scriptHash: EXTERNAL_INTEGRATIONS[network].contracts.aaCore,
      },
    },
    null,
    2,
  );
}

export function resolvePlayAreaOperationNetworkDefaults(
  appId: string,
  network: string | null | undefined,
  operations: OperationEntry[],
): OperationEntry[] {
  if (
    appId !== "miniapp-aa-account-lab" &&
    appId !== "miniapp-aa-permissions-lab" &&
    appId !== "miniapp-aa-market-hub" &&
    appId !== "miniapp-aa-relay-console" &&
    appId !== "miniapp-aa-session-key-lab"
  ) {
    return operations;
  }

  return operations.map((operation) => ({
    ...operation,
    params: operation.params?.map((param) =>
      withNetworkProfileDefaults(appId, network, param),
    ),
  }));
}

export function getNativePlayAreaOperationFallback(
  appId: string,
  network?: string | null,
): OperationEntry[] {
  if (appId === "miniapp-council-governance") {
    return [
      {
        name: "Create Proposal",
        method: "createProposal",
        description:
          "Submit a real text proposal to the Council Governance contract.",
        button_style: "primary",
        priority: "primary",
        confirm_message: "Create this council proposal on-chain?",
        params: [
          {
            name: "creator",
            type: "hash160",
            label: "Creator",
            default_value: "$wallet",
            hidden: true,
            required: true,
          },
          {
            name: "type",
            type: "integer",
            label: "Proposal type",
            default_value: "0",
            hidden: true,
            required: true,
          },
          {
            name: "title",
            type: "string",
            label: "Title",
            placeholder: "Council proposal title",
            required: true,
          },
          {
            name: "description",
            type: "string",
            label: "Description",
            placeholder: "What should council members review?",
            required: true,
          },
          {
            name: "policyData",
            type: "bytearray",
            label: "Policy data",
            default_value: "",
            hidden: true,
          },
          {
            name: "duration",
            type: "integer",
            label: "Voting window",
            default_value: "604800000",
            hidden: true,
            required: true,
          },
        ],
      },
      {
        name: "Vote For",
        method: "vote",
        description: "Cast a real for vote on an active proposal.",
        button_style: "success",
        priority: "primary",
        confirm_message: "Vote for this proposal on-chain?",
        params: [
          {
            name: "voter",
            type: "hash160",
            label: "Voter",
            default_value: "$wallet",
            hidden: true,
            required: true,
          },
          {
            name: "proposalId",
            type: "integer",
            label: "Proposal ID",
            required: true,
          },
          {
            name: "support",
            type: "boolean",
            label: "Support",
            default_value: "true",
            hidden: true,
            required: true,
          },
        ],
      },
      {
        name: "Vote Against",
        method: "vote",
        description: "Cast a real against vote on an active proposal.",
        button_style: "danger",
        priority: "primary",
        confirm_message: "Vote against this proposal on-chain?",
        params: [
          {
            name: "voter",
            type: "hash160",
            label: "Voter",
            default_value: "$wallet",
            hidden: true,
            required: true,
          },
          {
            name: "proposalId",
            type: "integer",
            label: "Proposal ID",
            required: true,
          },
          {
            name: "support",
            type: "boolean",
            label: "Support",
            default_value: "false",
            hidden: true,
            required: true,
          },
        ],
      },
      {
        name: "Finalize",
        method: "finalizeProposal",
        description:
          "Finalize an expired proposal after its voting window closes.",
        button_style: "secondary",
        priority: "secondary",
        confirm_message: "Finalize this proposal on-chain?",
        params: [
          {
            name: "proposalId",
            type: "integer",
            label: "Proposal ID",
            required: true,
          },
        ],
      },
      {
        name: "Revoke",
        method: "revokeProposal",
        description: "Revoke one of your own proposals before finalization.",
        button_style: "danger",
        priority: "operator",
        confirm_message: "Revoke this proposal on-chain?",
        params: [
          {
            name: "creator",
            type: "hash160",
            label: "Creator",
            default_value: "$wallet",
            hidden: true,
            required: true,
          },
          {
            name: "proposalId",
            type: "integer",
            label: "Proposal ID",
            required: true,
          },
        ],
      },
    ];
  }

  if (appId === "miniapp-forever-album") {
    return [
      {
        name: "Open upload workspace",
        method: "prepareMiniAppOperation",
        description:
          "Open the embedded Forever Album uploader with the selected privacy route. Choose images and submit the wallet storage write inside the live workspace.",
        button_style: "primary",
        params: [
          {
            name: "privacy",
            type: "select",
            label: "Privacy route",
            default_value: "public",
            options: [
              { label: "Public album record", value: "public" },
              { label: "Encrypted local privacy", value: "encrypted" },
            ],
          },
        ],
      },
    ];
  }

  if (appId === "miniapp-burn-league") {
    return [
      {
        name: "Prepare Burn Entry",
        method: "prepareMiniAppOperation",
        description:
          "Pre-fill the burn amount and open the embedded Burn League desk. Submit Burn Now inside the live dApp after reviewing the rank and reward preview.",
        button_style: "danger",
        priority: "primary",
        params: [
          {
            name: "amount",
            type: "amount",
            label: "Burn amount",
            default_value: "1",
            placeholder: "1",
            required: true,
            scale: 8,
            presets: [
              { label: "1", value: "1", helper: "GAS" },
              { label: "5", value: "5", helper: "GAS" },
              { label: "10", value: "10", helper: "GAS" },
            ],
          },
        ],
      },
    ];
  }

  if (appId === "miniapp-neo-pay-shared-example") {
    return [
      {
        name: "Create Stream",
        method: "createSharedStream",
        description:
          "Create a shared-runtime payment stream through the stream vesting module.",
        button_style: "primary",
        priority: "primary",
        confirm_message: "Create this shared-runtime payment stream on-chain?",
        params: [
          {
            name: "beneficiary",
            type: "address",
            label: "Beneficiary Address",
            placeholder: "N...",
            required: true,
          },
          {
            name: "asset",
            type: "hash160",
            label: "Asset",
            default_value: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
            hidden: true,
            required: true,
          },
          {
            name: "totalAmount",
            type: "amount",
            label: "Total Amount",
            placeholder: "20",
            scale: 8,
            required: true,
          },
          {
            name: "rateAmount",
            type: "amount",
            label: "Release Per Interval",
            placeholder: "1.5",
            scale: 8,
            required: true,
          },
          {
            name: "intervalSeconds",
            type: "integer",
            label: "Interval Seconds",
            default_value: "2592000",
            hidden: true,
            required: true,
          },
          {
            name: "title",
            type: "string",
            label: "Stream Name",
            placeholder: "Monthly payroll stream",
            required: true,
          },
          {
            name: "notes",
            type: "string",
            label: "Notes",
            placeholder: "Optional context",
          },
        ],
      },
    ];
  }

  if (appId === "miniapp-neo-pay") {
    return [
      {
        name: "Create Stream",
        method: "createStream",
        description:
          "Fund GAS and create a live NeoPay stream after reviewing beneficiary, total amount, release cadence, title, and notes.",
        button_style: "primary",
        priority: "primary",
        confirm_message: "Create this payment stream on-chain?",
        params: [
          {
            name: "creator",
            type: "hash160",
            label: "Creator",
            default_value: "$wallet",
            hidden: true,
            required: true,
          },
          {
            name: "beneficiary",
            type: "hash160",
            label: "Beneficiary",
            placeholder: "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu",
            required: true,
          },
          {
            name: "asset",
            type: "hash160",
            label: "Asset",
            default_value: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
            hidden: true,
            required: true,
          },
          {
            name: "totalAmount",
            type: "amount",
            label: "Total GAS",
            placeholder: "0.03",
            scale: 8,
            required: true,
            presets: [
              { label: "0.03", value: "0.03", helper: "GAS" },
              { label: "0.10", value: "0.10", helper: "GAS" },
              { label: "0.25", value: "0.25", helper: "GAS" },
            ],
          },
          {
            name: "rateAmount",
            type: "amount",
            label: "Daily release",
            placeholder: "0.03",
            scale: 8,
            required: true,
          },
          {
            name: "intervalSeconds",
            type: "integer",
            label: "Interval (seconds)",
            default_value: "86400",
            required: true,
          },
          {
            name: "title",
            type: "string",
            label: "Title",
            placeholder: "Testnet payroll stream",
            required: true,
          },
          {
            name: "notes",
            type: "string",
            label: "Notes",
            placeholder: "Optional memo",
          },
        ],
      },
      {
        name: "Claim Stream",
        method: "claimStream",
        description:
          "Claim vested funds from an incoming NeoPay stream using the connected beneficiary wallet.",
        button_style: "success",
        priority: "primary",
        confirm_message: "Claim vested funds from this stream?",
        params: [
          {
            name: "beneficiary",
            type: "hash160",
            label: "Beneficiary",
            default_value: "$wallet",
            hidden: true,
            required: true,
          },
          {
            name: "streamId",
            type: "integer",
            label: "Stream ID",
            placeholder: "1",
            required: true,
          },
        ],
      },
      {
        name: "Cancel Stream",
        method: "cancelStream",
        description:
          "Cancel one of your active outgoing streams and return unreleased funds to the creator.",
        button_style: "danger",
        priority: "operator",
        confirm_message: "Cancel this stream on-chain?",
        params: [
          {
            name: "creator",
            type: "hash160",
            label: "Creator",
            default_value: "$wallet",
            hidden: true,
            required: true,
          },
          {
            name: "streamId",
            type: "integer",
            label: "Stream ID",
            placeholder: "1",
            required: true,
          },
        ],
      },
    ];
  }

  if (appId === "miniapp-gasbox") {
    return [
      {
        name: "Open Draw Console",
        method: "prepareMiniAppOperation",
        description:
          "Open the embedded GasBox draw surface. Optionally preselect a machine ID, then submit the wallet draw from the dApp after reviewing odds.",
        button_style: "success",
        params: [
          {
            name: "machineId",
            type: "string",
            label: "Machine ID",
            placeholder: "Optional machine id",
          },
        ],
      },
    ];
  }

  const profile = PROFILED_PLAYAREAS[appId];
  if (!profile) return [];
  return [
    {
      name: profile.primaryAction,
      method: "prepareMiniAppOperation",
      description:
        "Apply the focused app parameters to the embedded MiniApp. Review and submit any wallet action inside the live workspace.",
      button_style: "primary",
      params: profile.fields
        .map(profileFieldToOperationParam)
        .map((param) => withNetworkProfileDefaults(appId, network, param)),
    },
  ];
}

function profileFieldToOperationParam(field: ProfileField): OperationParam {
  const defaultValue = profileDefaultValue(field);
  const label = field.label || field.key;
  const lower = `${field.key} ${label}`.toLowerCase();
  const type: OperationParam["type"] =
    field.paramType ??
    (field.type === "number"
      ? field.suffix?.toUpperCase().includes("GAS") ||
        field.suffix?.toUpperCase().includes("NEO")
        ? "amount"
        : "integer"
      : lower.includes("address") ||
          lower.includes("recipient") ||
          lower.includes("owner")
        ? "address"
        : lower.includes("hash")
          ? "hash256"
          : "string");

  return {
    name: field.key,
    type,
    label,
    required: field.required || undefined,
    default_value: defaultValue || undefined,
    placeholder: defaultValue ? undefined : field.defaultValue || undefined,
    presets: field.presets,
  };
}

function withNetworkProfileDefaults(
  appId: string,
  network: string | null | undefined,
  param: OperationParam,
): OperationParam {
  const resolvedNetwork = resolveNeoNetwork(network);
  const integration = EXTERNAL_INTEGRATIONS[resolvedNetwork];
  if (
    appId === "miniapp-aa-account-lab" ||
    appId === "miniapp-aa-permissions-lab"
  ) {
    if (
      param.name === "verifierHash" &&
      integration.contracts.aaWeb3AuthVerifier
    ) {
      return {
        ...param,
        type: "hash160",
        default_value: integration.contracts.aaWeb3AuthVerifier,
        placeholder: undefined,
      };
    }
    return param;
  }
  if (appId === "miniapp-aa-session-key-lab") {
    const dailyCheckinHash =
      MINIAPP_CONTRACTS[resolvedNetwork]["miniapp-dailycheckin"] || "";
    if (param.name === "targetContract" && dailyCheckinHash) {
      return {
        ...param,
        type: "hash160",
        default_value: dailyCheckinHash,
        placeholder: undefined,
      };
    }
    if (param.name === "expiresAt") {
      return {
        ...param,
        default_value: String(Math.floor(Date.now() / 1000) + 3600),
        placeholder: undefined,
      };
    }
    return param;
  }
  if (appId === "miniapp-aa-relay-console") {
    if (param.name === "payloadJson") {
      return {
        ...param,
        default_value: buildAARelayPayloadDefault(resolvedNetwork),
        placeholder: undefined,
      };
    }
    return param;
  }
  if (appId !== "miniapp-aa-market-hub") return param;
  const marketHash =
    MINIAPP_CONTRACTS[resolvedNetwork]["miniapp-aa-market-hub"] ||
    integration.contracts.aaAddressMarket ||
    "";

  if (param.name === "marketHash" && marketHash) {
    return {
      ...param,
      type: "hash160",
      default_value: marketHash,
      placeholder: undefined,
    };
  }
  if (param.name === "aaContractHash" && integration.contracts.aaCore) {
    return {
      ...param,
      type: "hash160",
      default_value: integration.contracts.aaCore,
      placeholder: undefined,
    };
  }
  return param;
}

function profileDefaultValue(field: ProfileField) {
  const value = field.defaultValue.trim();
  if (!value) return "";
  if (/(\.\.\.|builder|alice|bob|carol|cip-\d+)/i.test(value)) return "";
  if (field.paramType && field.paramType !== "string") return value;
  if (field.type === "number" || field.suffix) return value;
  if (
    [
      "action",
      "accountIdInput",
      "accountSeed",
      "asset",
      "dappId",
      "escapeTimelock",
      "expiresAt",
      "format",
      "allowedMethod",
      "verifierParamsHex",
      "listingTitle",
      "mode",
      "payloadJson",
      "route",
      "scope",
      "sponsorAmount",
      "threshold",
      "trigger",
      "vote",
    ].includes(field.key)
  ) {
    return value;
  }
  if (
    /^(approve|transfer|script hash|connected wallet|balances \+ approvals)$/i.test(
      value,
    )
  )
    return value;
  return "";
}
