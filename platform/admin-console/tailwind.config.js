/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("../shared/tailwind.preset.js")],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // WCAG AA overrides (scoped to the admin console; the shared preset
        // stays untouched for the host app). Each value is the nearest
        // hue-preserving darkening that reaches ≥4.6:1 on the light surfaces
        // where the token is used as text:
        //   neo-600 on white 3.23 -> 4.70, neo-700 on neo-50 4.39 -> 4.62,
        //   ink-muted on canvas-inset 2.96 -> 4.65, ink-faint on white 2.40 -> 4.61.
        neo: {
          600: "#0b845c",
          700: "#0b7e58",
        },
        ink: {
          muted: "#6b6965",
          faint: "#78756c",
        },
      },
    },
  },
  plugins: [],
};
