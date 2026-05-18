import type { OperationEntry, OperationParam } from "@/components/types";

import { PROFILED_PLAYAREAS, type ProfileField } from "./PlayAreaProfiles";

export function getNativePlayAreaOperationFallback(
  appId: string,
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
    return [];
  }

  if (appId === "miniapp-gasbox") {
    return [
      {
        name: "Draw Capsule",
        method: "prepareMiniAppOperation",
        description:
          "Choose the machine and draw count, then submit the prepared wallet action.",
        button_style: "success",
        params: [
          {
            name: "machine",
            type: "integer",
            label: "Machine",
            default_value: "1",
            required: true,
          },
          {
            name: "draws",
            type: "integer",
            label: "Draw count",
            default_value: "1",
            required: true,
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
        "Prepare the focused app parameters, then submit the wallet action.",
      button_style: "primary",
      params: profile.fields.map(profileFieldToOperationParam),
    },
  ];
}

function profileFieldToOperationParam(field: ProfileField): OperationParam {
  const defaultValue = profileDefaultValue(field);
  const label = field.label || field.key;
  const lower = `${field.key} ${label}`.toLowerCase();
  const type: OperationParam["type"] =
    field.type === "number"
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
          : "string";

  return {
    name: field.key,
    type,
    label,
    default_value: defaultValue || undefined,
    placeholder: defaultValue ? undefined : field.defaultValue || undefined,
  };
}

function profileDefaultValue(field: ProfileField) {
  const value = field.defaultValue.trim();
  if (!value) return "";
  if (/(\.\.\.|builder|alice|bob|carol|cip-\d+)/i.test(value)) return "";
  if (field.type === "number" || field.suffix) return value;
  if (
    [
      "action",
      "asset",
      "format",
      "mode",
      "route",
      "scope",
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
