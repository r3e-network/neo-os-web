/**
 * StandardAppShell — React equivalent of StandardAppShell.vue
 *
 * Simple wrapper that provides global styles/resets and CSS custom properties.
 * Imports the shared stylesheet and renders children inside a `.app-root` div.
 */

import React from "react";
import type { ReactNode } from "react";
import "./StandardAppShell.scss";

interface StandardAppShellProps {
  children: ReactNode;
}

export function StandardAppShell({ children }: StandardAppShellProps) {
  return <div className="app-root">{children}</div>;
}

export default StandardAppShell;
