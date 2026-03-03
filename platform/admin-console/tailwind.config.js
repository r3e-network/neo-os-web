/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#020617",
        foreground: "#f8fafc",
        primary: {
          50: "#eff6ff",
          100: "#ccfbea",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#00E599", // Neo Green
          600: "#00cc88",
          700: "#00b377",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
        neo: {
          DEFAULT: "#00E599",
          hover: "#00cc88",
          glow: "rgba(0, 229, 153, 0.4)",
        },
        electric: {
          purple: "#7000FF",
          glow: "rgba(112, 0, 255, 0.4)",
        },
      },
    },
  },
  plugins: [],
};
