/**
 * Neo MiniApps v4 Tailwind preset.
 *
 * Shared by the host app and admin console. Keep this aligned with
 * docs/DESIGN_LANGUAGE.md: warm canvas, white surfaces, restrained Neo green,
 * single elevation, and purposeful motion only.
 */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#faf9f7",
          alt: "#f4f2ef",
          inset: "#eeece9",
        },
        surface: {
          DEFAULT: "#ffffff",
          secondary: "#f8f7f5",
          hover: "#f1efec",
          raised: "#ffffff",
        },
        border: {
          DEFAULT: "#e8e6e1",
          secondary: "#e0ddd7",
          strong: "#d4d0c9",
          focus: "rgba(22,199,132,0.50)",
        },
        ink: {
          DEFAULT: "#1a1a19",
          secondary: "#5c5a56",
          muted: "#8b8984",
          faint: "#aaa7a0",
          inverse: "#ffffff",
        },
        neo: {
          50: "#e8f8f1",
          100: "#c5f0dd",
          200: "#9ce7c6",
          300: "#65dba8",
          400: "#34cf90",
          DEFAULT: "#16c784",
          500: "#16c784",
          600: "#0ea371",
          700: "#0b825a",
          800: "#086445",
          900: "#064b34",
        },
        success: {
          DEFAULT: "#22c55e",
          50: "#ecfdf3",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
        },
        warning: {
          DEFAULT: "#f59e0b",
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
        },
        danger: {
          DEFAULT: "#ef4444",
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626",
        },
        info: {
          DEFAULT: "#3b82f6",
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
        },
        cat: {
          game: { DEFAULT: "#f59e0b", soft: "#fffbeb" },
          defi: { DEFAULT: "#3b82f6", soft: "#eff6ff" },
          nft: { DEFAULT: "#8b5cf6", soft: "#f5f3ff" },
          tool: { DEFAULT: "#06b6d4", soft: "#ecfeff" },
          social: { DEFAULT: "#ec4899", soft: "#fdf2f8" },
          governance: { DEFAULT: "#6366f1", soft: "#eef2ff" },
        },
        background: "#faf9f7",
        foreground: "#1a1a19",
        primary: {
          DEFAULT: "#16c784",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#f4f2ef",
          foreground: "#1a1a19",
        },
        muted: {
          DEFAULT: "#f4f2ef",
          foreground: "#8b8984",
        },
        ring: "rgba(22,199,132,0.50)",
        input: "#d4d0c9",
        card: {
          DEFAULT: "#ffffff",
          foreground: "#1a1a19",
        },
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(0,0,0,0.03)",
        sm: "0 1px 3px rgba(0,0,0,0.04)",
        md: "0 4px 12px rgba(0,0,0,0.06)",
        lg: "0 12px 28px rgba(0,0,0,0.08)",
        brand: "0 2px 8px rgba(22,199,132,0.25)",
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out both",
        "slide-up": "slide-up 200ms ease-out both",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      transitionTimingFunction: {
        standard: "ease-out",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
