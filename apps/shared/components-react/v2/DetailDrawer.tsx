import React from "react";

/**
 * v2 DetailDrawer — tucks advanced/secondary parameters away.
 *
 * Solves "摊大饼 / too many options on the surface": everything the user does
 * not need at a glance (rules, history, advanced config, raw diagnostics) lives
 * here behind a toggle in the ActionRail. Slides in from below when opened.
 * Remains in normal document flow (not a modal) so the primary scene stays put.
 */
export interface DetailDrawerProps {
  category?: "game" | "defi" | "nft" | "tool";
  className?: string;
  open: boolean;
  /** Section label rendered as the drawer heading. */
  title?: React.ReactNode;
  children?: React.ReactNode;
}

export function DetailDrawer({
  category = "game",
  className,
  open,
  title,
  children,
}: DetailDrawerProps) {
  return (
    <section
      id="mx2-detail-drawer"
      className={[
        "mx2",
        `mx2-cat-${category}`,
        "mx2-drawer",
        open ? "mx2-drawer--open" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={!open}
    >
      {open && (
        <div className="mx2-drawer__inner mx2-drawer-in">
          {title && <h3 className="mx2-drawer__title">{title}</h3>}
          <div className="mx2-drawer__body">{children}</div>
        </div>
      )}
    </section>
  );
}
