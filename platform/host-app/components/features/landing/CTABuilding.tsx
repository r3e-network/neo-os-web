import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Rocket, FileText, Play } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

export function CTABuilding() {
  const { t } = useTranslation("host");

  return (
    <section className="py-32 px-4 relative overflow-hidden bg-background">
      {/* Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-neo/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_0)] bg-[size:32px_32px] opacity-20 pointer-events-none" />

      <div className="mx-auto max-w-5xl text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-neo/10 text-neo text-xs font-bold uppercase tracking-widest border border-neo/20 rounded-full mb-10 shadow-[0_0_15px_rgba(0,229,153,0.3)] backdrop-blur-md">
          <div className="w-2 h-2 bg-neo rounded-full animate-pulse shadow-[0_0_10px_#00E599]" />
          {t("landing.cta.badge")}
        </div>

        <h2 className="text-6xl md:text-8xl font-bold text-erobo-ink dark:text-white mb-10 tracking-tight leading-[1.1]">
          {t("landing.cta.title")} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-neo to-blue-500 inline-block mt-2 drop-shadow-2xl">
            {t("landing.cta.titleHighlight")}
          </span>
        </h2>

        <p className="text-xl md:text-2xl text-erobo-ink-soft dark:text-white/60 max-w-3xl mx-auto mb-16 leading-relaxed font-medium">
          {t("landing.cta.subtitle")}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-6">
          <Link href="#explore">
            <Button
              size="lg"
              className="bg-neo hover:bg-neo/90 text-black font-bold px-10 h-16 rounded-full border border-neo/50 shadow-[0_0_20px_rgba(0,229,153,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(0,229,153,0.6)] text-lg"
            >
              {t("landing.cta.startBuilding")} <Rocket className="ml-2" size={20} strokeWidth={2.5} />
            </Button>
          </Link>
          <Link href="/docs">
            <Button
              variant="outline"
              size="lg"
              className="border border-erobo-purple/15 dark:border-white/20 bg-erobo-purple/10 dark:bg-white/5 text-erobo-ink dark:text-white font-bold px-10 h-16 rounded-full backdrop-blur-md hover:bg-erobo-purple/15 dark:hover:bg-white/10 transition-all hover:scale-105 text-lg"
            >
              {t("landing.cta.readDocs")} <FileText className="ml-2" size={20} strokeWidth={2.5} />
            </Button>
          </Link>
          <Link href="/developer">
            <Button
              variant="ghost"
              size="lg"
              className="text-erobo-ink dark:text-white font-bold px-10 h-16 rounded-full hover:bg-erobo-purple/10 dark:hover:bg-white/5 transition-all text-lg group"
            >
              {t("landing.cta.tryPlayground")}{" "}
              <Play
                className="ml-2 group-hover:translate-x-1 transition-transform"
                size={20}
                strokeWidth={2.5}
                fill="currentColor"
              />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
