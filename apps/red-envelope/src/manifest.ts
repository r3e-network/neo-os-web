/**
 * Red Envelope Manifest
 *
 * Declarative configuration that tells the platform how to render
 * every section of the red-envelope miniapp except the play area.
 */

import type { MiniAppManifest } from "@shared/types/miniapp-manifest";

export const manifest: MiniAppManifest = {
  // -- Identity ---------------------------------------------------------------
  name: "Red Envelope",
  description:
    "Scan, claim, and optionally send lucky GAS red envelopes on Neo N3",
  icon: "gift",
  category: "social",
  shell: "launcher",

  // -- Tabs -------------------------------------------------------------------
  tabs: [
    { key: "claim", labelKey: "claimTabLabel", icon: "target", default: true },
    { key: "create", labelKey: "createTab", icon: "gift" },
    { key: "myEnvelopes", labelKey: "myEnvelopes", icon: "archive" },
  ],

  // -- Stats Grid -------------------------------------------------------------
  stats: [
    {
      labelKey: "sidebarEnvelopes",
      valueKey: "envelopeCount",
      format: "number",
      variant: "danger",
      icon: "gift",
    },
    {
      labelKey: "sidebarClaims",
      valueKey: "claimCount",
      format: "number",
      variant: "accent",
      icon: "check-circle",
    },
    {
      labelKey: "sidebarPools",
      valueKey: "poolCount",
      format: "number",
      icon: "users",
    },
  ],

  // -- Sidebar ----------------------------------------------------------------
  sidebar: {
    titleKey: "title",
    items: [
      {
        labelKey: "sidebarEnvelopes",
        valueKey: "envelopeCount",
        format: "number",
      },
      { labelKey: "sidebarClaims", valueKey: "claimCount", format: "number" },
      { labelKey: "sidebarPools", valueKey: "poolCount", format: "number" },
    ],
  },

  operations: [
    {
      key: "claimEnvelope",
      titleKey: "claimRedEnvelope",
      descriptionKey: "claimOperationDesc",
      actionKey: "claimNow",
      actionMethod: "claimEnvelope",
      priority: "primary",
      fields: [
        {
          key: "envelopeId",
          type: "text",
          labelKey: "envelopeId",
          placeholder: "Envelope ID from QR",
          required: true,
        },
      ],
    },
    {
      key: "createEnvelope",
      titleKey: "sendRedEnvelope",
      descriptionKey: "sendOperationDesc",
      actionKey: "sendRedEnvelope",
      actionMethod: "createEnvelope",
      priority: "secondary",
      fields: [
        {
          key: "amount",
          type: "amount",
          labelKey: "totalGas",
          placeholder: "0.00",
          required: true,
          validation: { min: 0.1 },
        },
        {
          key: "count",
          type: "number",
          labelKey: "packetCount",
          placeholder: "10",
          required: true,
          validation: { min: 1, max: 100 },
        },
        {
          key: "expiryHours",
          type: "number",
          labelKey: "expiryHours",
          placeholder: "24",
          default: 24,
          required: true,
          validation: { min: 1, max: 720 },
        },
      ],
    },
  ],

  // -- Features ---------------------------------------------------------------
  features: {
    fireworks: true,
    walletRequired: true,
    chainWarning: true,
  },

  // -- Docs -------------------------------------------------------------------
  docs: [
    { titleKey: "title", contentKey: "docSubtitle", type: "text" },
    { titleKey: "docDescription", contentKey: "step2", type: "steps" },
    { titleKey: "feature1Name", contentKey: "feature1Desc", type: "features" },
  ],

  // -- Contract ---------------------------------------------------------------
  contract: {
    mode: "custom",
  },

  // -- Permissions ------------------------------------------------------------
  permissions: {
    payments: true,
  },
};
