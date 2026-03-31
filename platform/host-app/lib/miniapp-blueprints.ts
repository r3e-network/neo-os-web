import type { MiniAppDetailTemplate, MiniAppInfo, OperationEntry } from "@/components/types";
import { asTrimmedString, deepClone } from "./miniapp-permissions";

export type MiniAppBlueprint = "default" | "prediction" | "gaming" | "defi" | "nft";
export type MiniAppAdminAction = "save_draft" | "publish" | "disable";

export type MiniAppBlueprintMetadata = {
  id: MiniAppBlueprint;
  label: string;
  description: string;
  layout: MiniAppDetailTemplate["layout"];
  tab_types: string[];
  starter: Record<string, unknown>;
};

type MiniAppBlueprintStarter = {
  action: MiniAppAdminAction;
  permissions: MiniAppInfo["permissions"];
  limits: {
    max_gas_per_tx: string;
    daily_gas_cap_per_user: string;
  };
  operations: OperationEntry[];
};

type MiniAppBlueprintDefinition = {
  id: MiniAppBlueprint;
  aliases: string[];
  label: string;
  description: string;
  template: MiniAppDetailTemplate;
  tabTypes: string[];
  starter: MiniAppBlueprintStarter;
};

// ---------------------------------------------------------------------------
// Blueprint definitions
// ---------------------------------------------------------------------------

const BLUEPRINT_DEFINITIONS: MiniAppBlueprintDefinition[] = [
  {
    id: "default",
    aliases: ["default", "general", "utility", "tools"],
    label: "Default",
    description: "General miniapp layout with overview/reviews/forum/news and operations panel.",
    template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "forum", label: "Forum", type: "forum" },
        { id: "news", label: "News", type: "news" },
      ],
      operation_panel: {
        title: "Operations",
        subtitle: "Configure parameters and submit the transaction.",
        cta_label: "Launch MiniApp",
        operations: [],
      },
    },
    tabTypes: ["content", "reviews", "forum", "news"],
    starter: {
      action: "save_draft",
      permissions: {
        payments: true,
      },
      limits: {
        max_gas_per_tx: "10",
        daily_gas_cap_per_user: "100",
      },
      operations: [],
    },
  },
  {
    id: "prediction",
    aliases: ["prediction", "prediction_market", "market"],
    label: "Prediction",
    description: "Polymarket-style layout with market info/commentary on left and trade box on right.",
    template: {
      layout: "prediction",
      hero: {
        eyebrow: "Prediction Market",
        disclaimer: "Probabilities are market-implied and can change quickly.",
      },
      tabs: [
        { id: "market-info", label: "Market Info", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "forum", label: "Comments", type: "forum" },
        { id: "news", label: "Activity", type: "news" },
      ],
      operation_panel: {
        title: "Trade Position",
        subtitle: "Choose side, set amount, and submit on-chain.",
        cta_label: "Open Full Experience",
        operations: [],
      },
    },
    tabTypes: ["content", "reviews", "forum", "news"],
    starter: {
      action: "save_draft",
      permissions: {
        payments: true,
        datafeed: true,
      },
      limits: {
        max_gas_per_tx: "10",
        daily_gas_cap_per_user: "100",
      },
      operations: [
        {
          name: "Buy Position",
          method: "buyPosition",
          button_style: "primary",
          params: [
            {
              name: "side",
              type: "select",
              required: true,
              options: [
                { label: "YES", value: "yes" },
                { label: "NO", value: "no" },
              ],
            },
            { name: "amount", type: "amount", required: true, placeholder: "10" },
          ],
        },
      ],
    },
  },
  {
    id: "gaming",
    aliases: ["gaming", "game"],
    label: "Gaming",
    description: "Game-oriented layout with leaderboard and play operations.",
    template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content" },
        { id: "leaderboard", label: "Leaderboard", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "news", label: "News", type: "news" },
      ],
      operation_panel: {
        title: "Play",
        subtitle: "Configure game parameters and start playing.",
        cta_label: "Launch Game",
        operations: [],
      },
    },
    tabTypes: ["content", "reviews", "news"],
    starter: {
      action: "save_draft",
      permissions: {
        payments: true,
      },
      limits: {
        max_gas_per_tx: "10",
        daily_gas_cap_per_user: "100",
      },
      operations: [
        {
          name: "Play Round",
          method: "play",
          button_style: "primary",
          params: [
            { name: "bet_amount", type: "amount", required: true, placeholder: "1" },
          ],
        },
      ],
    },
  },
  {
    id: "defi",
    aliases: ["defi", "finance"],
    label: "DeFi",
    description: "DeFi layout with pool info, positions, and deposit/withdraw operations.",
    template: {
      layout: "default",
      tabs: [
        { id: "pool-info", label: "Pool Info", type: "content" },
        { id: "positions", label: "Positions", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "news", label: "Activity", type: "news" },
      ],
      operation_panel: {
        title: "Manage Position",
        subtitle: "Deposit, withdraw, or claim rewards.",
        cta_label: "Open DeFi App",
        operations: [],
      },
    },
    tabTypes: ["content", "reviews", "news"],
    starter: {
      action: "save_draft",
      permissions: {
        payments: true,
      },
      limits: {
        max_gas_per_tx: "10",
        daily_gas_cap_per_user: "100",
      },
      operations: [
        {
          name: "Deposit",
          method: "deposit",
          button_style: "primary",
          params: [
            { name: "amount", type: "amount", required: true, placeholder: "10" },
          ],
        },
        {
          name: "Withdraw",
          method: "withdraw",
          button_style: "secondary",
          params: [
            { name: "amount", type: "amount", required: true, placeholder: "10" },
          ],
        },
      ],
    },
  },
  {
    id: "nft",
    aliases: ["nft", "collectible", "collectibles"],
    label: "NFT",
    description: "NFT collection layout with minting and transfer operations.",
    template: {
      layout: "default",
      tabs: [
        { id: "collection", label: "Collection", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" },
        { id: "forum", label: "Forum", type: "forum" },
      ],
      operation_panel: {
        title: "NFT Actions",
        subtitle: "Mint or transfer NFTs.",
        cta_label: "Open Collection",
        operations: [],
      },
    },
    tabTypes: ["content", "reviews", "forum"],
    starter: {
      action: "save_draft",
      permissions: {
        payments: true,
      },
      limits: {
        max_gas_per_tx: "10",
        daily_gas_cap_per_user: "100",
      },
      operations: [
        {
          name: "Mint",
          method: "mint",
          button_style: "primary",
          params: [
            { name: "token_id", type: "string", required: true, placeholder: "Token ID" },
          ],
        },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

const BLUEPRINT_DEFAULT_ID: MiniAppBlueprint = "default";

const BLUEPRINT_BY_ID = new Map<MiniAppBlueprint, MiniAppBlueprintDefinition>(
  BLUEPRINT_DEFINITIONS.map((definition) => [definition.id, definition]),
);

const BLUEPRINT_ALIAS_MAP = BLUEPRINT_DEFINITIONS.reduce<Record<string, MiniAppBlueprint>>((acc, definition) => {
  for (const alias of definition.aliases) {
    acc[alias] = definition.id;
  }
  acc[definition.id] = definition.id;
  return acc;
}, {});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getBlueprintDefinition(blueprint: MiniAppBlueprint): MiniAppBlueprintDefinition {
  return BLUEPRINT_BY_ID.get(blueprint) || BLUEPRINT_BY_ID.get(BLUEPRINT_DEFAULT_ID)!;
}

export function getBlueprintTemplate(blueprint: MiniAppBlueprint): MiniAppDetailTemplate {
  return deepClone(getBlueprintDefinition(blueprint).template);
}

export function normalizeBlueprint(value: unknown): MiniAppBlueprint {
  const raw = asTrimmedString(value).toLowerCase().replace(/\s+/g, "_");
  return BLUEPRINT_ALIAS_MAP[raw] || BLUEPRINT_DEFAULT_ID;
}

export function listMiniAppBlueprints(): MiniAppBlueprintMetadata[] {
  return BLUEPRINT_DEFINITIONS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    description: definition.description,
    layout: definition.template.layout,
    tab_types: [...definition.tabTypes],
    starter: {
      blueprint: definition.id,
      action: definition.starter.action,
      permissions: deepClone(definition.starter.permissions),
      limits: deepClone(definition.starter.limits),
      manifest: {
        page_template: deepClone(definition.template),
        operations: deepClone(definition.starter.operations),
      },
    },
  }));
}
