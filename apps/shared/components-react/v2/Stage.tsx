import React from "react";

/**
 * v2 Stage — the dominant interactive scene container.
 *
 * The redesigned miniapps lead with ONE scene (the game/deFi/tool operation),
 * not a flat form. Stage renders that scene on a clean white task surface,
 * and reserves a fixed slot for the primary
 * ActionRail below it. Secondary/advanced details go in a DetailDrawer, never
 * inline — this enforces the primary/secondary hierarchy the brief demands.
 *
 * Visual: clean scene plate (--mx2-scene-bg), generous padding, rounded
 * corners. Children are the scene props (dice, cards, gauges…).
 */
export interface StageProps {
  /** Category identity class applied to the root (e.g. "mx2-cat-game"). */
  category?: "game" | "defi" | "nft" | "tool";
  className?: string;
  /** The scene itself — the die/cards/gauge/flow diagram. */
  children?: React.ReactNode;
  /** Eyebrow label above the scene (small uppercase). */
  eyebrow?: string;
  /** Scene title. */
  title?: React.ReactNode;
  /** Short subtitle/description. */
  subtitle?: React.ReactNode;
  /** Optional badge(s) top-right of the scene (network, live status). */
  badges?: React.ReactNode;
}

export function Stage({
  category = "game",
  className,
  children,
  eyebrow,
  title,
  subtitle,
  badges,
}: StageProps) {
  return (
    <section
      className={["mx2", `mx2-cat-${category}`, "mx2-stage", className]
        .filter(Boolean)
        .join(" ")}
    >
      {(eyebrow || title || subtitle || badges) && (
        <header className="mx2-stage__head">
          <div className="mx2-stage__titles">
            {eyebrow && <p className="mx2-eyebrow">{eyebrow}</p>}
            {title && <h2 className="mx2-stage__title">{title}</h2>}
            {subtitle && <p className="mx2-stage__subtitle">{subtitle}</p>}
          </div>
          {badges && <div className="mx2-stage__badges">{badges}</div>}
        </header>
      )}
      <div className="mx2-stage__scene">{children}</div>
    </section>
  );
}
