/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
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
        background: "#020617",
        foreground: "#f8fafc",
        neo: {
          DEFAULT: "#00E599",
          hover: "#00cc88",
          glow: "rgba(0, 229, 153, 0.4)",
        },
        electric: {
          purple: "#7000FF",
          glow: "rgba(112, 0, 255, 0.4)",
        },
        card: {
          DEFAULT: "rgba(15, 23, 42, 0.6)",
          foreground: "#f8fafc",
        },
      },
      backgroundImage: {
        "glass-gradient": "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)",
        "neo-purple-grad": "linear-gradient(135deg, #00E599 0%, #7000FF 100%)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
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
        "swap-left": "swap-left 2s ease-in-out infinite",
        "swap-right": "swap-right 2s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
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
        "swap-left": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(70px)" },
        },
        "swap-right": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(-70px)" },
        },
      },
    },
  },
  plugins: [],
};
