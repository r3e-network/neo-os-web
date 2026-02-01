// MiniApp Platform Styles

// Light theme colors
export const lightColors = {
  bg: "#f8fafc",
  bgCard: "rgba(255,255,255,0.95)",
  bgSection: "#f1f5f9",
  primary: "#00a080",
  primaryDark: "#008060",
  text: "#1e293b",
  textMuted: "#475569",
  border: "rgba(0,0,0,0.12)",
  accent: "#3498db",
};

// Dark theme colors - improved contrast
export const darkColors = {
  bg: "#0f172a",
  bgCard: "rgba(30,41,59,0.95)",
  bgSection: "#1e293b",
  primary: "#00d4aa",
  primaryDark: "#00a080",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  border: "rgba(255,255,255,0.15)",
  accent: "#3498db",
};

// Default export for backward compatibility (dark theme)
export const colors = darkColors;

export const shadows = {
  card: "0 4px 20px rgba(0,0,0,0.3)",
  glow: "0 0 30px rgba(0,212,170,0.2)",
};

// Hook to get theme-aware colors (must be used in component)
export function getThemeColors(theme: "dark" | "light") {
  return theme === "dark" ? darkColors : lightColors;
}
