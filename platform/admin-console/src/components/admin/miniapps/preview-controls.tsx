// =============================================================================
// PreviewControls — Theme / Locale toggle for MiniApp previews
// =============================================================================

"use client";

import { Button } from "@/components/ui/Button";

interface PreviewControlsProps {
  theme: "dark" | "light";
  locale: "en" | "zh";
  onThemeChange: (theme: "dark" | "light") => void;
  onLocaleChange: (locale: "en" | "zh") => void;
}

export function PreviewControls({ theme, locale, onThemeChange, onLocaleChange }: PreviewControlsProps) {
  return (
    <div className="border-border/20 bg-muted/30 rounded-lg border p-4">
      <div className="mb-3 text-sm font-medium text-foreground/80">Preview Controls</div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Theme</span>
          <Button size="sm" variant={theme === "dark" ? "primary" : "secondary"} onClick={() => onThemeChange("dark")}>
            Dark
          </Button>
          <Button
            size="sm"
            variant={theme === "light" ? "primary" : "secondary"}
            onClick={() => onThemeChange("light")}
          >
            Light
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Locale</span>
          <Button size="sm" variant={locale === "en" ? "primary" : "secondary"} onClick={() => onLocaleChange("en")}>
            EN
          </Button>
          <Button size="sm" variant={locale === "zh" ? "primary" : "secondary"} onClick={() => onLocaleChange("zh")}>
            ZH
          </Button>
        </div>
      </div>
    </div>
  );
}
