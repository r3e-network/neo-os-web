"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "../providers/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-full bg-white dark:bg-white/10 text-erobo-ink dark:text-slate-200 shadow-sm hover:bg-erobo-purple/10 dark:hover:bg-white/20 transition-all active:scale-95 border border-erobo-purple/15 dark:border-white/10"
      title={`Theme: ${theme}`}
    >
      {theme === "dark" ? <Sun size={20} strokeWidth={2.5} /> : <Moon size={20} strokeWidth={2.5} />}
    </button>
  );
}
