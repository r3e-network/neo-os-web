import React from "react";
import { cn } from "@/lib/utils";

type PageHeroStat = {
  label: string;
  value: string;
  hint?: string;
};

type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  stats?: PageHeroStat[];
  children?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
};

export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  stats = [],
  children,
  align = "left",
  className,
}: PageHeroProps) {
  const centered = align === "center";

  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-gray-200/60",
        className,
      )}
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(0,229,153,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(0,163,255,0.10),transparent_28%)]" />
      <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 sm:py-16">
        <div
          className={cn(
            "flex flex-col gap-8",
            centered ? "items-center text-center" : "items-start",
          )}
        >
          <div className={cn("max-w-4xl", centered && "mx-auto")}>
            {eyebrow && (
              <p className="text-xs font-semibold uppercase text-neo">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-3 text-3xl font-black text-gray-900 sm:text-5xl">
              {title}
            </h1>
            {description && (
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-gray-600 sm:text-lg">
                {description}
              </p>
            )}
            {(actions || children) && (
              <div
                className={cn(
                  "mt-6",
                  centered && "flex w-full flex-col items-center",
                )}
              >
                {actions && (
                  <div
                    className={cn(
                      "flex flex-wrap gap-3",
                      centered && "justify-center",
                    )}
                  >
                    {actions}
                  </div>
                )}
                {children && <div className="mt-4 w-full">{children}</div>}
              </div>
            )}
          </div>

          {stats.length > 0 && (
            <div
              className={cn(
                "grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4",
                centered && "max-w-5xl",
              )}
            >
              {stats.map((stat) => (
                <div
                  key={`${stat.label}-${stat.value}`}
                  className="rounded-2xl border border-gray-200/70 bg-white/80 px-4 py-3 shadow-sm"
                >
                  <div className="text-xs uppercase text-gray-500">
                    {stat.label}
                  </div>
                  <div className="mt-2 text-2xl font-black text-gray-900">
                    {stat.value}
                  </div>
                  {stat.hint && (
                    <div className="mt-1 text-xs text-gray-500">
                      {stat.hint}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
