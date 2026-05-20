/**
 * Per-ecosystem accent palette.
 *
 * Polymarket gives each market category its own restrained color signature
 * (politics blue, crypto gold, sports orange). We follow the same idea for
 * the six miniapp ecosystems, used for: category sidebar active state,
 * count badge, card left-edge accent stripe, and card hover border.
 *
 * Every entry uses Tailwind utility classes so the JSX call sites stay
 * declarative. Values stay quiet — 8–12% bg tints on white, 200-shade
 * borders, 700-shade text — so the palette signals without shouting.
 */

export type CategoryId =
  | "all"
  | "gaming"
  | "defi"
  | "social"
  | "nft"
  | "governance"
  | "utility";

export interface CategoryTheme {
  /** Solid hex used for the accent stripe and dot indicators. */
  accent: string;
  /** Tailwind background tint for active/hover surfaces. */
  bgTint: string;
  /** Tailwind border color when active/hovered. */
  borderActive: string;
  /** Tailwind text color when active. */
  text: string;
  /** Tailwind background for the count badge when active. */
  countBg: string;
  /** Tailwind text for the count badge when active. */
  countText: string;
}

const PALETTE: Record<CategoryId, CategoryTheme> = {
  all: {
    accent: "#6b7280",
    bgTint: "bg-gray-50",
    borderActive: "border-gray-300",
    text: "text-gray-800",
    countBg: "bg-gray-200",
    countText: "text-gray-700",
  },
  gaming: {
    accent: "#7c3aed",
    bgTint: "bg-violet-50",
    borderActive: "border-violet-200",
    text: "text-violet-700",
    countBg: "bg-violet-100",
    countText: "text-violet-800",
  },
  defi: {
    accent: "#059669",
    bgTint: "bg-emerald-50",
    borderActive: "border-emerald-200",
    text: "text-emerald-700",
    countBg: "bg-emerald-100",
    countText: "text-emerald-800",
  },
  social: {
    accent: "#ec4899",
    bgTint: "bg-pink-50",
    borderActive: "border-pink-200",
    text: "text-pink-700",
    countBg: "bg-pink-100",
    countText: "text-pink-800",
  },
  nft: {
    accent: "#d97706",
    bgTint: "bg-amber-50",
    borderActive: "border-amber-200",
    text: "text-amber-800",
    countBg: "bg-amber-100",
    countText: "text-amber-900",
  },
  governance: {
    accent: "#4f46e5",
    bgTint: "bg-indigo-50",
    borderActive: "border-indigo-200",
    text: "text-indigo-700",
    countBg: "bg-indigo-100",
    countText: "text-indigo-800",
  },
  utility: {
    accent: "#0284c7",
    bgTint: "bg-sky-50",
    borderActive: "border-sky-200",
    text: "text-sky-700",
    countBg: "bg-sky-100",
    countText: "text-sky-800",
  },
};

export function getCategoryTheme(category: string | null | undefined): CategoryTheme {
  const key = (category ?? "all").toLowerCase() as CategoryId;
  return PALETTE[key] ?? PALETTE.all;
}
