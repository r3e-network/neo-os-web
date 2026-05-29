/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("../shared/tailwind.preset.js")],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: "#16c784",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#7b61ff",
          100: "#eeeaff",
          800: "#5b3fe0",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#f7f8fa",
          foreground: "#8a92a6",
        },
        accent: {
          DEFAULT: "#f7f8fa",
          foreground: "#1e1e2e",
        },
        destructive: {
          DEFAULT: "#ea3943",
          foreground: "#ffffff",
        },
        ring: "#7b61ff",
        input: "#e6e8ee",
        border: "#e6e8ee",
        card: {
          DEFAULT: "#ffffff",
          foreground: "#1e1e2e",
        },
        dark: {
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
      },
      backgroundImage: {
        "glass-gradient": "linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0) 100%)",
        "neo-purple-grad": "linear-gradient(135deg, #16c784 0%, #7b61ff 100%)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      boxShadow: {
        sm: "0 2px 8px rgba(20, 22, 38, 0.05)",
        md: "0 8px 24px rgba(20, 22, 38, 0.06)",
        lg: "0 16px 40px rgba(20, 22, 38, 0.1)",
        xl: "0 24px 60px rgba(20, 22, 38, 0.14)",
        "2xl": "0 32px 72px rgba(20, 22, 38, 0.16)",
        neo: "0 8px 24px rgba(22, 199, 132, 0.22)",
        "neo-sm": "0 2px 12px rgba(22, 199, 132, 0.16)",
        "purple-sm": "0 2px 12px rgba(123, 97, 255, 0.16)",
      },
      animation: {
        "pulse-slow": "pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "border-glow": "border-glow 4s ease infinite",
        "float-slow": "float 6s ease-in-out infinite",
        "float-medium": "float 4s ease-in-out infinite",
        "float-fast": "float 2.5s ease-in-out infinite",
        "bounce-slow": "bounce-gentle 3s ease-in-out infinite",
        draw: "draw 2s ease-in-out infinite",
        "draw-delayed": "draw 2s ease-in-out 0.5s infinite",
      },
      keyframes: {
        "border-glow": {
          "0%, 100%": { "border-color": "rgba(0, 229, 153, 0.2)" },
          "50%": { "border-color": "rgba(112, 0, 255, 0.5)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-5px) scale(1.02)" },
        },
        draw: {
          "0%": { "stroke-dasharray": "0, 500" },
          "50%": { "stroke-dasharray": "200, 500" },
          "100%": { "stroke-dasharray": "0, 500" },
        },
      },
    },
  },
  plugins: [],
};
