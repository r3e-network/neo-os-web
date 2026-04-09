/**
 * FlamingoAppShell — React equivalent of FlamingoAppShell.vue
 *
 * Simple wrapper providing Flamingo-specific global styles.
 * Same pattern as StandardAppShell but with different theme defaults.
 */

import React from "react";
import type { ReactNode } from "react";
import "./FlamingoAppShell.scss";

interface FlamingoAppShellProps {
  children: ReactNode;
}

export function FlamingoAppShell({ children }: FlamingoAppShellProps) {
  return <div className="app-root">{children}</div>;
}

export default FlamingoAppShell;
