import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Rocket, FileText, Play } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

export function CTABuilding() {
    const { t } = useTranslation("host");

    return (
        <section className="py-32 px-4 relative overflow-hidden bg-gray-50/50 dark:bg-dark-900/30">
            {/* Background decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-br from-neo/5 to-indigo-500/5 blur-[120px] -z-10" />

            <div className="mx-auto max-w-5xl text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-wider border border-emerald-500/20 mb-8 backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {t("landing.cta.badge")}
                </div>

                <h2 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white mb-8 tracking-tight">
                    {t("landing.cta.title")} <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-neo to-indigo-400">
                        {t("landing.cta.titleHighlight")}
                    </span>
                </h2>

                <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
                    {t("landing.cta.subtitle")}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-4">
                    <Link href="#explore">
                        <Button size="lg" className="bg-neo hover:bg-neo/90 text-dark-950 font-bold px-10 h-16 rounded-2xl shadow-xl shadow-neo/20 transition-all hover:scale-105">
                            {t("landing.cta.startBuilding")} <Rocket className="ml-2" size={20} />
                        </Button>
                    </Link>
                    <Link href="/docs">
                        <Button variant="outline" size="lg" className="border-gray-300 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm text-gray-900 dark:text-white font-bold px-10 h-16 rounded-2xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
                            {t("landing.cta.readDocs")} <FileText className="ml-2" size={20} />
                        </Button>
                    </Link>
                    <Link href="/developer">
                        <Button variant="ghost" size="lg" className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-bold px-10 h-16 rounded-2xl group transition-all">
                            {t("landing.cta.tryPlayground")} <Play className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
