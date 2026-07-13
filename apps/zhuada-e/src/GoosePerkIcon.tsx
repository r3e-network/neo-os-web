/**
 * R8b — Graphical perk badge for the collection book.
 *
 * Each collected goose surfaces one passive bonus (see goose-passive.ts).
 * Before R8b the book rendered that bonus as bare text. Now every perk gets a
 * consistent lucide icon so the collection reads at a glance — the exact value
 * copy still renders alongside it (PlayArea.tsx), the icon is recognition, not
 * a replacement for the number.
 *
 * The map is the single source of truth: if a new goose's perkKey is missing
 * here, GoosePerkIcon.test.ts fails loudly instead of silently dropping the
 * icon. Keep this in lockstep with GOOSE_PASSIVES in goose-passive.ts.
 */
import {
  Lightbulb,
  ArrowUpFromLine,
  Clock,
  Timer,
  Undo2,
  Milestone,
  Shuffle,
  Percent,
  Flame,
  type LucideIcon,
} from "lucide-react";

/** perkKey (messages.ts) → the lucide icon that represents it. */
export const PERK_ICON: Record<string, LucideIcon> = {
  goosePerkGarden: Lightbulb, // +1 提示 (hint)
  goosePerkOrchard: ArrowUpFromLine, // +1 移出 (remove from pile)
  goosePerkPond: Clock, // 晃动冷却 −1s (shake cooldown)
  goosePerkFarm: Timer, // 连击窗口 +200ms (combo window)
  goosePerkSnowfield: Undo2, // +1 撤回 (undo)
  goosePerkNightMarket: Milestone, // 里程碑阈值 ×0.9
  goosePerkVolcano: Shuffle, // +1 洗牌 (extra shuffle)
  goosePerkCloud: Percent, // +5% 分数 (score bonus)
  goosePerkAbyss: Flame, // 狂潮门槛 −1 (frenzy trigger)
};

export interface GoosePerkIconProps {
  perkKey: string;
  size?: number;
}

export function GoosePerkIcon({ perkKey, size = 13 }: GoosePerkIconProps) {
  const Icon = PERK_ICON[perkKey];
  if (!Icon) return null;
  return (
    <Icon size={size} strokeWidth={2.25} aria-hidden="true" className="goose-perk__icon" />
  );
}

export default GoosePerkIcon;
