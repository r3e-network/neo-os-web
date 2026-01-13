/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["class"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
      },
      colors: {
        // Standard Admin Colors (Aliased to Primary/Success/etc for compatibility)
        primary: {
          50: "#f0fdf9",
          100: "#ccfbf0",
          200: "#99f6e0",
          300: "#5cebc6",
          400: "#22dba8",
          500: "#00e599", // Neo Green
          600: "#00be7e",
          700: "#009665",
          800: "#067551",
          900: "#066044",
        },
        success: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#00e599", // Aligned with Brand
          600: "#16a34a",
          700: "#15803d",
        },
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          500: "#FDE047", // Brutal Yellow
          600: "#d97706",
          700: "#b45309",
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          500: "#EF4444", // Brutal Red
          600: "#dc2626",
          700: "#b91c1c",
        },
        // Neo / E-Robo Design System
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
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
          DEFAULT: "rgba(255, 255, 255, 0.9)",
          dark: "rgba(10, 15, 30, 0.6)",
        },
        brutal: {
          border: "rgba(255, 255, 255, 0.1)",
          yellow: "#FDE047",
          pink: "#F472B6",
          blue: "#22D3EE",
          orange: "#FB923C",
          red: "#EF4444",
          lime: "#A3E635",
        },
        erobo: {
          purple: "#9f9df3",
          "purple-dark": "#7b79d1",
          pink: "#f7aac7",
          peach: "#f8d7c2",
          mint: "#d8f2e2",
          sky: "#d9ecff",
          ink: "#1b1b2f",
          "ink-soft": "#45455c",
        },
      },
      boxShadow: {
        "brutal-sm": "0 2px 10px rgba(0,0,0,0.2)",
        "brutal-md": "0 8px 30px rgba(0,0,0,0.3)",
        "brutal-lg": "0 20px 40px rgba(0,0,0,0.4)",
        "brutal-neo": "0 0 25px rgba(0, 229, 153, 0.4), 0 0 10px rgba(0, 229, 153, 0.2)",
        "brutal-purple": "0 0 25px rgba(112, 0, 255, 0.4), 0 0 10px rgba(112, 0, 255, 0.2)",
      },
      backgroundImage: {
        "glass-gradient": "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
        "neo-purple-grad": "linear-gradient(135deg, #00E599 0%, #7000FF 100%)",
      },
      animation: {
        "pulse-slow": "pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "border-glow": "border-glow 4s ease infinite",
        "float-slow": "float 6s ease-in-out infinite",
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
      }
    },
  },
  plugins: [],
};
