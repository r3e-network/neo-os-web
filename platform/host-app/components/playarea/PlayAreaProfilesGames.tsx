import { Layers3, Trophy, Zap } from "lucide-react";

import type { PlayAreaProfile } from "./PlayAreaProfileTypes";

const DEFAULT_GAME_FIELDS = [
  {
    key: "difficulty",
    label: "Difficulty",
    defaultValue: "normal",
  },
];

function gameProfile({
  title,
  subtitle,
  tone,
  icon,
  cards,
  steps,
  primaryAction,
  visual,
}: Pick<
  PlayAreaProfile,
  | "title"
  | "subtitle"
  | "tone"
  | "icon"
  | "cards"
  | "steps"
  | "primaryAction"
  | "visual"
>): PlayAreaProfile {
  return {
    title,
    subtitle,
    tone,
    icon,
    embeddedHeightClass: "h-[1180px] sm:h-[1040px] lg:h-[960px]",
    fields: DEFAULT_GAME_FIELDS,
    cards,
    steps,
    primaryAction,
    visual,
  };
}

export const GAME_PROFILED_PLAYAREAS: Record<string, PlayAreaProfile> = {
  "miniapp-aim-master": gameProfile({
    title: "Aim Master range",
    subtitle:
      "Hit the target pattern, bind the score, and settle the verified result through the game dApp.",
    tone: "rose",
    icon: <Zap className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "precision" },
      { label: "Proof", value: "Morpheus" },
      { label: "Reward", value: "score" },
    ],
    steps: ["Choose difficulty", "Play the range", "Seal score", "Claim result"],
    primaryAction: "Start aim run",
    visual: {
      headline: "Target run",
      slots: ["Pattern", "Timer", "Score", "Settlement"],
    },
  }),
  "miniapp-color-clash": gameProfile({
    title: "Color Clash arena",
    subtitle:
      "Match the color state, resolve the round, and keep the dApp surface in charge of the game loop.",
    tone: "violet",
    icon: <Layers3 className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "match" },
      { label: "State", value: "round" },
      { label: "Proof", value: "sealed" },
    ],
    steps: ["Pick round", "Match colors", "Commit move", "Reveal outcome"],
    primaryAction: "Start clash",
    visual: {
      headline: "Color board",
      slots: ["Palette", "Move", "Round", "Receipt"],
    },
  }),
  "miniapp-curve-arrow": gameProfile({
    title: "Curve Arrow range",
    subtitle:
      "Bend the arrow around the walls in the dApp and settle every verified bullseye run on-chain.",
    tone: "emerald",
    icon: <Zap className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "archery" },
      { label: "Control", value: "hold-to-curve" },
      { label: "Goal", value: "bullseye" },
    ],
    steps: ["Start range", "Curve arrows", "Seal run", "Settle reward"],
    primaryAction: "Start range",
    visual: {
      headline: "Archery range",
      slots: ["Bow", "Walls", "Target", "Settlement"],
    },
  }),
  "miniapp-flappy-dash": gameProfile({
    title: "Flappy Dash course",
    subtitle:
      "Run the side-scroller in the embedded dApp, then submit the verified distance for settlement.",
    tone: "sky",
    icon: <Zap className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "dash" },
      { label: "Target", value: "pipes" },
      { label: "Proof", value: "TEE" },
    ],
    steps: ["Start run", "Clear gates", "Seal distance", "Settle reward"],
    primaryAction: "Start dash",
    visual: {
      headline: "Dash course",
      slots: ["Gate", "Timing", "Distance", "Result"],
    },
  }),
  "miniapp-game-2048": gameProfile({
    title: "2048 strategy board",
    subtitle:
      "Merge tiles in the real game board and keep every move available for deterministic verification.",
    tone: "amber",
    icon: <Layers3 className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "merge" },
      { label: "Board", value: "4x4" },
      { label: "Goal", value: "2048" },
    ],
    steps: ["Open board", "Merge tiles", "Lock trace", "Claim score"],
    primaryAction: "Start board",
    visual: {
      headline: "Merge grid",
      slots: ["Tiles", "Moves", "Score", "Trace"],
    },
  }),
  "miniapp-jump-rush": gameProfile({
    title: "Jump Rush course",
    subtitle:
      "Cross the platform course, capture the run proof, and settle only after the dApp verifies the path.",
    tone: "emerald",
    icon: <Zap className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "platform" },
      { label: "Target", value: "distance" },
      { label: "Risk", value: "fall" },
    ],
    steps: ["Start course", "Time jumps", "Bind run", "Resolve payout"],
    primaryAction: "Start rush",
    visual: {
      headline: "Platform run",
      slots: ["Course", "Jump", "Timer", "Receipt"],
    },
  }),
  "miniapp-merge-kingdom": gameProfile({
    title: "Merge Kingdom board",
    subtitle:
      "Build the board through merge moves, then settle the kingdom state through the embedded dApp.",
    tone: "amber",
    icon: <Trophy className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "merge" },
      { label: "State", value: "kingdom" },
      { label: "Reward", value: "tier" },
    ],
    steps: ["Choose map", "Merge pieces", "Seal board", "Claim tier"],
    primaryAction: "Start kingdom",
    visual: {
      headline: "Kingdom board",
      slots: ["Piece", "Merge", "Rank", "Reward"],
    },
  }),
  "miniapp-pet-potion": gameProfile({
    title: "Potion lab",
    subtitle:
      "Brew the run inside the game dApp, verify the recipe state, and settle the outcome cleanly.",
    tone: "rose",
    icon: <Trophy className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "recipe" },
      { label: "State", value: "brew" },
      { label: "Proof", value: "sealed" },
    ],
    steps: ["Pick recipe", "Brew round", "Seal result", "Collect reward"],
    primaryAction: "Start brew",
    visual: {
      headline: "Brew station",
      slots: ["Recipe", "Meter", "Result", "Claim"],
    },
  }),
  "miniapp-sheep-solitaire": gameProfile({
    title: "Solitaire board",
    subtitle:
      "Clear the layered board in the embedded dApp while the platform keeps chain status nearby.",
    tone: "emerald",
    icon: <Layers3 className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "solitaire" },
      { label: "Board", value: "layers" },
      { label: "Goal", value: "clear" },
    ],
    steps: ["Deal board", "Match layers", "Seal clear", "Claim result"],
    primaryAction: "Start board",
    visual: {
      headline: "Layer board",
      slots: ["Cards", "Layer", "Tray", "Outcome"],
    },
  }),
  "miniapp-snake-bounty": gameProfile({
    title: "Snake Bounty grid",
    subtitle:
      "Play the grid in the dApp, grow safely, and submit a verifiable run for reward settlement.",
    tone: "emerald",
    icon: <Zap className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "grid" },
      { label: "Target", value: "length" },
      { label: "Risk", value: "crash" },
    ],
    steps: ["Start grid", "Collect food", "Seal path", "Settle bounty"],
    primaryAction: "Start bounty",
    visual: {
      headline: "Bounty grid",
      slots: ["Path", "Food", "Length", "Settlement"],
    },
  }),
  "miniapp-sudoku": gameProfile({
    title: "Sudoku proof board",
    subtitle:
      "Solve the puzzle in the dApp and keep the final proof flow tied to the board state.",
    tone: "sky",
    icon: <Trophy className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "logic" },
      { label: "Board", value: "9x9" },
      { label: "Proof", value: "solution" },
    ],
    steps: ["Choose puzzle", "Fill board", "Verify solution", "Claim proof"],
    primaryAction: "Start puzzle",
    visual: {
      headline: "Puzzle board",
      slots: ["Grid", "Notes", "Check", "Receipt"],
    },
  }),
};
