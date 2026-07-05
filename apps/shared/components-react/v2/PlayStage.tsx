import React, { useState } from "react";

import { Stage, type StageProps } from "./Stage";
import { ScoreReadout, type ScoreReadoutProps } from "./ScoreReadout";
import { ActionRail, type ActionRailProps } from "./ActionRail";
import { DetailDrawer, type DetailDrawerProps } from "./DetailDrawer";

/**
 * v2 PlayStage — the canonical layout scaffold for a redesigned miniapp.
 *
 * Enforces the primary/secondary hierarchy: one dominant interactive Stage on
 * top, a compact ScoreReadout, a single-primary ActionRail, and an optional
 * tucked-away DetailDrawer. Apps compose their scene into <PlayStage> rather
 * than hand-laying-out, so every miniapp reads as "a primary thing you do, with
 * supporting context available on demand" — never a flat form.
 *
 * The drawer is managed internally (open state) but apps pass its content.
 */
export interface PlayStageProps {
  category?: "game" | "defi" | "nft" | "tool";
  className?: string;
  /** Stage scene config (eyebrow/title/subtitle/badges). */
  stage: Omit<StageProps, "category" | "children">;
  /** The scene props (die, cards, gauge…) rendered inside the Stage. */
  scene: React.ReactNode;
  /** Live readout items above the action rail. */
  score?: ScoreReadoutProps["items"];
  /** Primary + secondary actions. */
  actions: Omit<ActionRailProps, "category" | "readout" | "drawerOpen" | "onToggleDrawer">;
  /** Content for the tucked-away detail drawer (rules, history, diagnostics). */
  drawer?: Omit<DetailDrawerProps, "open"> & { children?: React.ReactNode };
  drawerToggleLabel?: string;
}

export function PlayStage({
  category = "game",
  className,
  stage,
  scene,
  score,
  actions,
  drawer,
  drawerToggleLabel,
}: PlayStageProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasDrawer = Boolean(drawer);
  return (
    <div className={["mx2", `mx2-cat-${category}`, "mx2-playstage", className]
      .filter(Boolean)
      .join(" ")}>
      <Stage category={category} {...stage}>
        {scene}
      </Stage>
      {score && score.length > 0 && (
        <ScoreReadout category={category} items={score} />
      )}
      <ActionRail
        category={category}
        {...actions}
        readout={null}
        drawerOpen={drawerOpen}
        onToggleDrawer={hasDrawer ? () => setDrawerOpen((v) => !v) : undefined}
        drawerToggleLabel={drawerToggleLabel}
      />
      {hasDrawer && (
        <DetailDrawer category={category} {...drawer} open={drawerOpen}>
          {drawer?.children}
        </DetailDrawer>
      )}
    </div>
  );
}
