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
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
      },
      colors: {
        /* Use CSS variables for theme-aware colors */
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        dark: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
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
        card: {
          /* Light: white with subtle transparency, Dark: dark glass */
          DEFAULT: "rgba(255, 255, 255, 0.9)",
          dark: "rgba(10, 15, 30, 0.6)",
          foreground: "hsl(var(--foreground))",
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
        // E-Robo Style Colors
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
        // Dark mode variants (Mapped to soft deep shadows + subtle border glow)
        "brutal-sm-dark": "0 2px 10px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)",
        "brutal-md-dark": "0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
        "brutal-lg-dark": "0 25px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)",
      },
      borderWidth: {
        3: "1px",
      },
      backgroundImage: {
        "glass-gradient": "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
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
        "reverse-spin": "spin 3s linear infinite reverse",
        // Gaming animations
        "slot-spin": "slot-spin 0.5s ease-in-out infinite",
        "coin-flip": "coin-flip 2s ease-in-out infinite",
        "dice-roll": "dice-roll 1s ease-in-out infinite",
        "scratch-reveal": "scratch-reveal 2s ease-in-out infinite",
        "scratch-shine": "scratch-shine 2s linear infinite",
        "card-shuffle": "card-shuffle 1.5s ease-in-out infinite",
        "rocket-launch": "rocket-launch 2s ease-in-out infinite",
        "candle-green": "candle-pulse 1s ease-in-out infinite",
        "candle-red": "candle-pulse 1s ease-in-out infinite 0.5s",
        "battle-left": "battle-left 1s ease-in-out infinite",
        "battle-right": "battle-right 1s ease-in-out infinite",
        "chess-move": "chess-move 2s ease-in-out infinite",
        "fog-drift": "fog-drift 3s ease-in-out infinite",
        "puzzle-left": "puzzle-left 2s ease-in-out infinite",
        "puzzle-right": "puzzle-right 2s ease-in-out infinite",
        "riddle-bounce": "riddle-bounce 1.5s ease-in-out infinite",
        "key-appear": "key-appear 2s ease-in-out infinite",
        "piano-key": "piano-key 0.5s ease-in-out infinite",
        "map-pan": "map-pan 4s ease-in-out infinite",
        "pin-drop": "pin-drop 2s ease-in-out infinite",
        "pickaxe-swing": "pickaxe-swing 1s ease-in-out infinite",
        "gem-sparkle": "gem-sparkle 1s ease-in-out infinite",
        soundwave: "soundwave 0.5s ease-in-out infinite alternate",
        // DeFi animations
        "lightning-flash": "lightning-flash 1s ease-in-out infinite",
        "coin-fly": "coin-fly 1.5s ease-in-out infinite",
        "chart-draw": "chart-draw 2s ease-in-out infinite",
        "grid-pulse": "grid-pulse 1s ease-in-out infinite",
        "bridge-connect": "bridge-connect 2s ease-in-out infinite",
        "shield-pulse": "shield-pulse 2s ease-in-out infinite",
        "capsule-grow": "capsule-grow 2s ease-in-out infinite",
        ripple: "ripple 2s ease-out infinite",
        // E-Robo Water Wave Animations
        "water-wave": "water-wave 12s ease-in-out infinite",
        "water-wave-reverse": "water-wave-reverse 15s ease-in-out infinite",
        "concentric-ripple": "concentric-ripple 2s ease-out infinite",
        "ripple-expand": "ripple-expand 0.8s ease-out forwards",
        "price-drop": "price-drop 1.5s ease-in-out infinite",
        orbit: "orbit 3s linear infinite",
        "orbit-reverse": "orbit 3s linear infinite reverse",
        "burger-stack": "burger-stack 2s ease-in-out infinite",
        "ticker-scroll": "ticker-scroll 4s linear infinite",
        // Social animations
        heartbeat: "heartbeat 1.5s ease-in-out infinite",
        "envelope-open": "envelope-open 2s ease-in-out infinite",
        "coin-burst": "coin-burst 2s ease-in-out infinite",
        "radio-wave": "radio-wave 1s ease-out infinite",
        "coin-rain": "coin-rain 2s linear infinite",
        "target-lock": "target-lock 2s ease-in-out infinite",
        "tear-left": "tear-left 2s ease-in-out infinite",
        "tear-right": "tear-right 2s ease-in-out infinite",
        "folder-open": "folder-open 2s ease-in-out infinite",
        "file-pop": "file-pop 2s ease-in-out infinite",
        "spotlight-scan": "spotlight-scan 3s ease-in-out infinite",
        "whisper-chain": "whisper-chain 1.5s ease-in-out infinite",
        "eye-open": "eye-open 2s ease-in-out infinite",
        unlock: "unlock 2s ease-in-out infinite",
        "switch-toggle": "switch-toggle 2s ease-in-out infinite",
        "capsule-bury": "capsule-bury 2s ease-in-out infinite",
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
        // Gaming keyframes
        "slot-spin": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "coin-flip": {
          "0%": { transform: "rotateY(0deg)" },
          "50%": { transform: "rotateY(180deg)" },
          "100%": { transform: "rotateY(360deg)" },
        },
        "dice-roll": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(90deg)" },
          "50%": { transform: "rotate(180deg)" },
          "75%": { transform: "rotate(270deg)" },
        },
        "scratch-reveal": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7", transform: "scale(1.05)" },
        },
        "scratch-shine": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "card-shuffle": {
          "0%, 100%": { transform: "translateX(0) rotate(0deg)" },
          "50%": { transform: "translateX(10px) rotate(5deg)" },
        },
        "rocket-launch": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "candle-pulse": {
          "0%, 100%": { opacity: "1", transform: "scaleY(1)" },
          "50%": { opacity: "0.8", transform: "scaleY(1.1)" },
        },
        "battle-left": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(10px)" },
        },
        "battle-right": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(-10px)" },
        },
        "chess-move": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(20px)" },
        },
        "fog-drift": {
          "0%, 100%": { opacity: "0.3", transform: "translateX(0)" },
          "50%": { opacity: "0.6", transform: "translateX(10px)" },
        },
        "puzzle-left": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(10px)" },
        },
        "puzzle-right": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(-10px)" },
        },
        "riddle-bounce": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-10px) rotate(10deg)" },
        },
        "key-appear": {
          "0%, 40%": { opacity: "0", transform: "scale(0)" },
          "60%, 100%": { opacity: "1", transform: "scale(1)" },
        },
        "piano-key": {
          "0%, 100%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(0.9)" },
        },
        "map-pan": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "25%": { transform: "translate(10px, -5px)" },
          "75%": { transform: "translate(-10px, 5px)" },
        },
        "pin-drop": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-30px)" },
        },
        "pickaxe-swing": {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(-30deg)" },
        },
        "gem-sparkle": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(1.2)" },
        },
        soundwave: {
          "0%": { transform: "scaleY(0.5)" },
          "100%": { transform: "scaleY(1.5)" },
        },
        // DeFi keyframes
        "lightning-flash": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3", transform: "scale(1.1)" },
        },
        "coin-fly": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(20px, -20px)" },
        },
        "chart-draw": {
          "0%": { "stroke-dashoffset": "200" },
          "100%": { "stroke-dashoffset": "0" },
        },
        "grid-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        "bridge-connect": {
          "0%, 100%": { transform: "scaleX(0.5)", opacity: "0.5" },
          "50%": { transform: "scaleX(1)", opacity: "1" },
        },
        "shield-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
        },
        "capsule-grow": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
        },
        ripple: {
          "0%": { transform: "scale(0.5)", opacity: "1" },
          "100%": { transform: "scale(2)", opacity: "0" },
        },
        "price-drop": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(15px)" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg) translateX(30px) rotate(0deg)" },
          "100%": { transform: "rotate(360deg) translateX(30px) rotate(-360deg)" },
        },
        "burger-stack": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        "ticker-scroll": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(-100%)" },
        },
        // Social keyframes
        heartbeat: {
          "0%, 100%": { transform: "scale(1)" },
          "25%": { transform: "scale(1.1)" },
          "50%": { transform: "scale(1)" },
          "75%": { transform: "scale(1.1)" },
        },
        "envelope-open": {
          "0%, 100%": { transform: "rotateX(0deg)" },
          "50%": { transform: "rotateX(-20deg)" },
        },
        "coin-burst": {
          "0%, 100%": { transform: "translateY(0)", opacity: "0" },
          "50%": { transform: "translateY(-20px)", opacity: "1" },
        },
        "radio-wave": {
          "0%": { transform: "scaleX(0)", opacity: "1" },
          "100%": { transform: "scaleX(1)", opacity: "0" },
        },
        "coin-rain": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "50%": { opacity: "1" },
          "100%": { transform: "translateY(200%)", opacity: "0" },
        },
        "target-lock": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.5" },
          "50%": { transform: "scale(0.8)", opacity: "1" },
        },
        "tear-left": {
          "0%, 100%": { transform: "translateX(0) rotate(0deg)" },
          "50%": { transform: "translateX(-10px) rotate(-10deg)" },
        },
        "tear-right": {
          "0%, 100%": { transform: "translateX(0) rotate(0deg)" },
          "50%": { transform: "translateX(10px) rotate(10deg)" },
        },
        "folder-open": {
          "0%, 100%": { transform: "perspective(100px) rotateX(0deg)" },
          "50%": { transform: "perspective(100px) rotateX(-15deg)" },
        },
        "file-pop": {
          "0%, 100%": { transform: "translateY(0)", opacity: "0" },
          "50%": { transform: "translateY(-15px)", opacity: "1" },
        },
        "spotlight-scan": {
          "0%, 100%": { transform: "translateX(-50%) rotate(0deg)" },
          "50%": { transform: "translateX(50%) rotate(360deg)" },
        },
        "whisper-chain": {
          "0%, 100%": { transform: "scale(0.8)", opacity: "0.5" },
          "50%": { transform: "scale(1)", opacity: "1" },
        },
        "eye-open": {
          "0%, 100%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(0.3)" },
        },
        unlock: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(-15deg)" },
        },
        "switch-toggle": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(24px)" },
        },
        "capsule-bury": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(10px)" },
        },
        // E-Robo Water Wave Keyframes
        "water-wave": {
          "0%": { transform: "translateX(0) translateY(0)" },
          "50%": { transform: "translateX(-25px) translateY(10px)" },
          "100%": { transform: "translateX(0) translateY(0)" },
        },
        "water-wave-reverse": {
          "0%": { transform: "translateX(0) translateY(0)" },
          "50%": { transform: "translateX(25px) translateY(-10px)" },
          "100%": { transform: "translateX(0) translateY(0)" },
        },
        "concentric-ripple": {
          "0%": { transform: "scale(0)", opacity: "0.5" },
          "50%": { opacity: "0.3" },
          "100%": { transform: "scale(3)", opacity: "0" },
        },
        "ripple-expand": {
          "0%": { transform: "scale(0)", opacity: "0.6" },
          "100%": { transform: "scale(4)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
