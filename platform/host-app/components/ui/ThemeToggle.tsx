"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Theme, applyTheme, getStoredTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const icons = { light: Sun, dark: Moon, system: Monitor };
  const Icon = icons[theme];

  const cycle = () => {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  return (
    <button onClick={cycle} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title={`Theme: ${theme}`}>
      <Icon size={20} />
    </button>
  );
}
