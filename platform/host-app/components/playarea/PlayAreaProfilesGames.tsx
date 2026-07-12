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
      "Play the full illustrated target range locally with moving patterns, combos, sound, and saved best scores.",
    tone: "rose",
    icon: <Zap className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "precision" },
      { label: "Control", value: "tap to fire" },
      { label: "Progress", value: "saved locally" },
    ],
    steps: ["Choose difficulty", "Track the target", "Build a combo", "Beat your best"],
    primaryAction: "Start aim run",
    visual: {
      headline: "Target run",
      slots: ["Pattern", "Timer", "Combo", "Best"],
    },
  }),
  "miniapp-arrow-escape": gameProfile({
    title: "Garden Arrowworks board",
    subtitle:
      "Release each mechanical arrow in dependency order on the real Phaser board, with deterministic local seeds and verified recovery.",
    tone: "emerald",
    icon: <Layers3 className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "escape rays" },
      { label: "Board", value: "9x12 garden" },
      { label: "Recovery", value: "witness + replay" },
    ],
    steps: ["Scan escape rays", "Release a clear arrow", "Protect three shields", "Clear the garden"],
    primaryAction: "Open arrow board",
    visual: {
      headline: "Escape garden",
      slots: ["Arrow", "Ray", "Shield", "Clear"],
    },
  }),
  "miniapp-bead-workshop": gameProfile({
    title: "Bead Workshop board",
    subtitle:
      "Lift connected bead patches, use the tray deliberately, and restore the certified local pattern in the real Phaser board.",
    tone: "amber",
    icon: <Layers3 className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "connected patches" },
      { label: "Board", value: "140 beads" },
      { label: "Recovery", value: "pause + undo" },
    ],
    steps: ["Select a patch", "Move or park it", "Restore the pattern", "Open a new board"],
    primaryAction: "Open workshop",
    visual: {
      headline: "Craft pattern",
      slots: ["Beads", "Sockets", "Tray", "Completion"],
    },
  }),
  "miniapp-fruit-funnel": gameProfile({
    title: "Fruit Funnel orchard",
    subtitle:
      "Release front fruit into the woven chute, create adjacent pairs, and recover the deterministic local orchard safely.",
    tone: "amber",
    icon: <Layers3 className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "adjacent pairs" },
      { label: "Orchard", value: "48 fruit" },
      { label: "Recovery", value: "pause + undo" },
    ],
    steps: ["Read the front fruit", "Release a safe pair", "Protect seven chute slots", "Clear the orchard"],
    primaryAction: "Open orchard",
    visual: {
      headline: "Pair orchard",
      slots: ["Vines", "Fruit", "Funnel", "Pairs"],
    },
  }),
  "miniapp-color-clash": gameProfile({
    title: "Color Clash arena",
    subtitle:
      "Watch the illuminated sequence, repeat it from memory, and advance through a complete local Simon challenge.",
    tone: "violet",
    icon: <Layers3 className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "match" },
      { label: "Rounds", value: "progressive" },
      { label: "Input", value: "touch + keys" },
    ],
    steps: ["Choose a route", "Watch the lights", "Repeat the sequence", "Clear the finale"],
    primaryAction: "Start clash",
    visual: {
      headline: "Color board",
      slots: ["Palette", "Sequence", "Round", "Result"],
    },
  }),
  "miniapp-curve-arrow": gameProfile({
    title: "Curve Arrow range",
    subtitle:
      "Bend arrows around walls, preserve momentum, and land clean bullseyes in the complete local Phaser range.",
    tone: "emerald",
    icon: <Zap className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "archery" },
      { label: "Control", value: "hold-to-curve" },
      { label: "Goal", value: "bullseye" },
    ],
    steps: ["Start range", "Curve arrows", "Clear the walls", "Land the bullseye"],
    primaryAction: "Start range",
    visual: {
      headline: "Archery range",
      slots: ["Bow", "Walls", "Target", "Result"],
    },
  }),
  "miniapp-flappy-dash": gameProfile({
    title: "Flappy Dash course",
    subtitle:
      "Fly the illustrated bird through real pipe courses with tactile flaps, three pace curves, and instant restarts.",
    tone: "sky",
    icon: <Zap className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "dash" },
      { label: "Target", value: "pipes" },
      { label: "Progress", value: "saved best" },
    ],
    steps: ["Choose a course", "Tap to flap", "Clear the gates", "Beat your best"],
    primaryAction: "Start dash",
    visual: {
      headline: "Dash course",
      slots: ["Bird", "Gate", "Distance", "Best"],
    },
  }),
  "miniapp-game-2048": gameProfile({
    title: "2048 strategy board",
    subtitle:
      "Slide illustrated building tiles, merge the kingdom upward, and resume the exact local board after a refresh.",
    tone: "amber",
    icon: <Layers3 className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "merge" },
      { label: "Board", value: "4x4" },
      { label: "Goal", value: "2048" },
    ],
    steps: ["Choose a target", "Slide the board", "Merge buildings", "Reach the summit"],
    primaryAction: "Start board",
    visual: {
      headline: "Merge grid",
      slots: ["Tiles", "Moves", "Undo", "Best"],
    },
  }),
  "miniapp-jump-rush": gameProfile({
    title: "Jump Rush course",
    subtitle:
      "Charge precise jumps, land in golden zones, collect carrots, and recover a paused local platform run.",
    tone: "emerald",
    icon: <Zap className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "platform" },
      { label: "Target", value: "distance" },
      { label: "Risk", value: "fall" },
    ],
    steps: ["Choose a course", "Charge the jump", "Hit the gold zone", "Reach the finish"],
    primaryAction: "Start rush",
    visual: {
      headline: "Platform run",
      slots: ["Course", "Jump", "Carrot", "Finish"],
    },
  }),
  "miniapp-merge-kingdom": gameProfile({
    title: "Merge Kingdom board",
    subtitle:
      "Drag and combine a twelve-stage illustrated building set, grow the kingdom, and resume the board locally.",
    tone: "amber",
    icon: <Trophy className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "merge" },
      { label: "Buildings", value: "12 stages" },
      { label: "Recovery", value: "local save" },
    ],
    steps: ["Choose a map", "Move buildings", "Merge matching tiers", "Raise the kingdom"],
    primaryAction: "Start kingdom",
    visual: {
      headline: "Kingdom board",
      slots: ["Building", "Merge", "Tier", "Kingdom"],
    },
  }),
  "miniapp-pet-potion": gameProfile({
    title: "Potion lab",
    subtitle:
      "Care for an illustrated pet, balance its needs, collect four essences, and brew a complete local potion.",
    tone: "rose",
    icon: <Trophy className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "recipe" },
      { label: "Care", value: "four tools" },
      { label: "Recovery", value: "auto-save" },
    ],
    steps: ["Choose a nursery", "Balance care", "Collect essences", "Brew the potion"],
    primaryAction: "Start brew",
    visual: {
      headline: "Brew station",
      slots: ["Pet", "Care", "Recipe", "Potion"],
    },
  }),
  "miniapp-screw-sort": gameProfile({
    title: "Screw Sort workshop",
    subtitle:
      "Free the layered planks, route each tactile screw into its matching case, and recover the complete local puzzle safely.",
    tone: "amber",
    icon: <Layers3 className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "layered sorting" },
      { label: "Capacity", value: "5 safe sockets" },
      { label: "Recovery", value: "pause + 3 undo" },
    ],
    steps: ["Free the top planks", "Sort three matching screws", "Manage overflow", "Clear the workshop"],
    primaryAction: "Open workshop",
    visual: {
      headline: "Sorting bench",
      slots: ["Planks", "Screws", "Cases", "Overflow"],
    },
  }),
  "miniapp-sheep-solitaire": gameProfile({
    title: "Solitaire board",
    subtitle:
      "Uncover layered illustrated tiles, manage the seven-slot tray, match triples, and recover the local board.",
    tone: "emerald",
    icon: <Layers3 className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "solitaire" },
      { label: "Board", value: "layers" },
      { label: "Goal", value: "clear" },
    ],
    steps: ["Deal the meadow", "Uncover a tile", "Match three", "Clear the board"],
    primaryAction: "Start board",
    visual: {
      headline: "Layer board",
      slots: ["Cards", "Layer", "Tray", "Outcome"],
    },
  }),
  "miniapp-snake-bounty": gameProfile({
    title: "Snake Bounty grid",
    subtitle:
      "Guide the illustrated snake, collect food and bounty marks, avoid collisions, and chase a saved local best.",
    tone: "emerald",
    icon: <Zap className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "grid" },
      { label: "Target", value: "length" },
      { label: "Risk", value: "crash" },
    ],
    steps: ["Choose a route", "Steer the snake", "Collect food", "Beat the bounty"],
    primaryAction: "Start bounty",
    visual: {
      headline: "Bounty grid",
      slots: ["Snake", "Food", "Length", "Best"],
    },
  }),
  "miniapp-sudoku": gameProfile({
    title: "Sudoku proof board",
    subtitle:
      "Solve a clean nine-by-nine board with notes, conflict feedback, keyboard controls, and exact local recovery.",
    tone: "sky",
    icon: <Trophy className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "logic" },
      { label: "Board", value: "9x9" },
      { label: "Recovery", value: "saved board" },
    ],
    steps: ["Choose a puzzle", "Enter candidates", "Resolve conflicts", "Complete the grid"],
    primaryAction: "Start puzzle",
    visual: {
      headline: "Puzzle board",
      slots: ["Grid", "Notes", "Conflicts", "Complete"],
    },
  }),
  "miniapp-zhuada-e": gameProfile({
    title: "Goose pen",
    subtitle:
      "Pull items from the physics pile into the tray, match three of a kind, and clear the pen in the embedded dApp.",
    tone: "emerald",
    icon: <Layers3 className="h-5 w-5" />,
    cards: [
      { label: "Mode", value: "3-match" },
      { label: "Pen", value: "physics" },
      { label: "Goal", value: "clear" },
    ],
    steps: ["Pick a pen", "Grab items", "Match triples", "Catch the goose"],
    primaryAction: "Start grabbing",
    visual: {
      headline: "Physics pen",
      slots: ["Pile", "Tray", "Shelf", "Goose"],
    },
  }),
};
