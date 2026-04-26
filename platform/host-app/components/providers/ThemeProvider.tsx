"use client";

import type { ReactNode } from "react";
import {
  ThemeProvider as DesignSystemThemeProvider,
  useTheme,
} from "@/lib/design-system/theme";
export type { ColorScheme, Theme, ThemeMode } from "@/lib/design-system/theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <DesignSystemThemeProvider
      defaultMode="light"
      enableSystemDetection={false}
    >
      {children}
    </DesignSystemThemeProvider>
  );
}

export { useTheme };
