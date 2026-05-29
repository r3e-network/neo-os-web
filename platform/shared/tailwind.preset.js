/**
 * Shared Tailwind CSS preset for Neo MiniApps (Neo Soft design system).
 *
 * Contains the common design-system tokens (brand colors, surfaces) used by
 * both host-app and admin-console. App-specific overrides live in each app's
 * own tailwind.config.js. Canonical reference: docs/DESIGN_SYSTEM.md
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        /* ── surface (Neo Soft light) ─────────────────────── */
        background: "#f4f5f7",
        foreground: "#1e1e2e",
        ink: "#1e1e2e",

        /* ── brand: Neo Green ─────────────────────────────── */
        neo: {
          DEFAULT: "#16c784",
          hover: "#0fb174",
          glow: "rgba(22, 199, 132, 0.4)",
        },

        /* ── interactive: Violet ──────────────────────────── */
        violet: {
          DEFAULT: "#7b61ff",
          hover: "#6a4df4",
          soft: "#eeeaff",
          glow: "rgba(123, 97, 255, 0.4)",
        },

        /* ── brand: Electric Purple (legacy alias → violet) ─ */
        electric: {
          purple: "#7b61ff",
          glow: "rgba(123, 97, 255, 0.4)",
        },

        /* ── primary (shared subset) ─────────────────────── */
        primary: {
          100: "#d6f7ec",
          500: "#16c784",
          600: "#0fb174",
          700: "#0c9c66",
        },
      },
      ringColor: {
        neo: "rgba(123, 97, 255, 0.3)",
      },
    },
  },
  plugins: [],
};
