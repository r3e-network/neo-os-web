import type { MiniAppDetailTemplate, OperationEntry, OperationParam } from "@/components/types";

type AppTemplate = { detail_template: MiniAppDetailTemplate; operations: OperationEntry[] };
type KV = { key: string; value: string };

const amt = (name = "amount", label = "Amount (GAS)", ph = "1"): OperationParam => ({ name, type: "amount", label, required: true, placeholder: ph });
const sel = (name: string, label: string, opts: string[]): OperationParam => ({ name, type: "select", label, required: true, options: opts.map(o => ({ label: o, value: o.toLowerCase().replace(/\s+/g, "_") })) });
const int = (name: string, label: string, ph = ""): OperationParam => ({ name, type: "integer", label, required: true, placeholder: ph });

const op = (name: string, method: string, style: OperationEntry["button_style"] = "primary", params: OperationParam[] = []): OperationEntry => ({ name, method, button_style: style, params });

function gaming(notice: string, kvExtra: KV[], steps: string[], ops: OperationEntry[]): AppTemplate {
  return {
    detail_template: {
      layout: "default",
      tabs: [
        { id: "overview", label: "Overview", type: "content", blocks: [
          { type: "notice", tone: "info", content: notice },
          { type: "key_value", title: "Quick Facts", items: [{ key: "Category", value: "Gaming" }, { key: "Asset", value: "GAS" }, ...kvExtra] },
          { type: "bullet_list", title: "How To Play", items: steps },
        ]},
        { id: "leaderboard", label: "Leaderboard", type: "content" },
        { id: "reviews", label: "Reviews", type: "reviews" }
      ],
      operation_panel: { title: "Play", subtitle: "Configure game parameters and start playing.", cta_label: "Launch Game", operations: [] },
    },
    operations: ops,
  };
}

const T_LOTTERY = gaming("Experience the thrill of provably fair lottery draws.", [{ key: "Randomness", value: "VRF" }], ["Buy tickets.", "Wait for the draw.", "Claim your prize."], [op("Buy Tickets", "buyTicket", "primary", [int("tickets", "Number of Tickets", "1")])]);
const T_COINFLIP = gaming("Classic 50/50 coin flip.", [{ key: "Randomness", value: "VRF" }], ["Choose Heads or Tails.", "Set your wager.", "Flip and win double."], [op("Flip", "flip", "primary", [sel("side", "Side", ["Heads", "Tails"]), amt()])]);
const T_DICE = gaming("Roll the dice and test your luck.", [{ key: "Randomness", value: "VRF" }], ["Choose your winning range.", "Place your bet.", "Watch the VRF-powered dice."], [op("Roll", "roll", "primary", [int("range", "Range (1-100)", "50"), amt()])]);

const T_PREDICTION: AppTemplate = {
  detail_template: {
    layout: "prediction",
    hero: { eyebrow: "Prediction Market", disclaimer: "Probabilities are market-implied." },
    tabs: [{ id: "market-info", label: "Market Info", type: "content" }, { id: "reviews", label: "Reviews", type: "reviews" }],
    operation_panel: { title: "Trade Position", subtitle: "Choose side, set amount, submit on-chain.", cta_label: "Open Full Experience", operations: [] }
  },
  operations: [op("Buy YES", "buyYes", "primary", [amt()]), op("Buy NO", "buyNo", "danger", [amt()])]
};

export const BUILTIN_APP_TEMPLATES: Record<string, AppTemplate> = {
  "miniapp-lottery": T_LOTTERY,
  "miniapp-coinflip": T_COINFLIP,
  "miniapp-dicegame": T_DICE,
  "miniapp-prediction-market": T_PREDICTION
};