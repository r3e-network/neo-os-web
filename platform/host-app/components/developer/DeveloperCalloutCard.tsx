"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight, ExternalLink } from "lucide-react";

type DeveloperCalloutCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description?: string;
  bullets?: string[];
  accentClassName: string;
  surfaceClassName: string;
  codeLines?: string[];
  href?: string;
  ctaLabel: string;
  ctaVariant?: "docs" | "builder";
  onClick?: () => void;
};

export function DeveloperCalloutCard({
  icon: Icon,
  title,
  subtitle,
  description,
  bullets = [],
  accentClassName,
  surfaceClassName,
  codeLines = [],
  href,
  ctaLabel,
  ctaVariant = "docs",
  onClick,
}: DeveloperCalloutCardProps) {
  const button = (
    <Button onClick={onClick} className={surfaceClassName}>
      {ctaLabel}
      {ctaVariant === "docs" ? (
        <ChevronRight size={16} className="ml-1" aria-hidden="true" />
      ) : (
        <ExternalLink size={16} className="ml-2" aria-hidden="true" />
      )}
    </Button>
  );

  return (
    <div className="glass-card rounded-3xl border border-gray-200/50 bg-white/60 p-8 backdrop-blur-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${accentClassName}`}
        >
          <Icon className="text-white" size={24} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>
      </div>

      {codeLines.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 font-mono text-sm shadow-inner">
          {codeLines.map((line, index) => (
            <div
              key={`${title}-line-${index}`}
              className={line.startsWith("#") ? "text-gray-400" : "text-neo"}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {description && <p className="mb-6 text-gray-600">{description}</p>}

      {bullets.length > 0 && (
        <ul className="mb-6 space-y-2">
          {bullets.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 text-sm text-gray-600"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-neo" />
              {item}
            </li>
          ))}
        </ul>
      )}

      {href ? <Link href={href}>{button}</Link> : button}
    </div>
  );
}
