/**
 * Shared Tailwind CSS preset for Yiwu MiniApps.
 *
 * Contains the common design-system tokens (brand colors, dark-mode strategy)
 * used by both host-app and admin-console.  App-specific overrides live in
 * each app's own tailwind.config.js.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        /* ── surface ──────────────────────────────────────── */
        background: "#020617",
        foreground: "#f8fafc",

        /* ── brand: Neo Green ─────────────────────────────── */
        neo: {
          DEFAULT: "#00E599",
          hover: "#00cc88",
          glow: "rgba(0, 229, 153, 0.4)",
        },

        /* ── brand: Electric Purple ───────────────────────── */
        electric: {
          purple: "#7000FF",
          glow: "rgba(112, 0, 255, 0.4)",
        },

        /* ── primary (shared subset) ─────────────────────── */
        primary: {
          100: "#ccfbea",
          500: "#00E599",
          600: "#00cc88",
          700: "#00b377",
        },
      },
      ringColor: {
        neo: "rgba(0, 229, 153, 0.3)",
      },
    },
  },
  plugins: [],
};
