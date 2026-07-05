/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("../shared/tailwind.preset.js")],
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
