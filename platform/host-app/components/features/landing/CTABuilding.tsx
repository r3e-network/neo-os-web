import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Rocket, FileText, Play } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

export function CTABuilding() {
    const { t } = useTranslation("host");

    return (
        <section className="py-32 px-4 relative overflow-hidden bg-[#ffde59]">
            {/* Background decoration - Neo Grid */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

            <div className="mx-auto max-w-5xl text-center relative z-10">
                <div className="inline-flex items-center gap-3 px-6 py-2 bg-black text-white border-4 border-black text-sm font-black uppercase tracking-tighter mb-10 shadow-brutal-xs -rotate-2">
                    <div className="w-3 h-3 bg-[#00E599] animate-pulse" />
                    {t("landing.cta.badge")}
                </div>

                <h2 className="text-6xl md:text-8xl font-black text-black mb-10 tracking-tighter leading-none uppercase italic">
                    {t("landing.cta.title")} <br />
                    <span className="bg-black text-[#00E599] px-4 py-2 inline-block mt-2 shadow-brutal-md -rotate-1">
                        {t("landing.cta.titleHighlight")}
                    </span>
                </h2>

                <p className="text-2xl text-black max-w-3xl mx-auto mb-16 leading-none font-black uppercase tracking-tight">
                    {t("landing.cta.subtitle")}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-6">
                    <Link href="#explore">
                        <Button size="lg" className="bg-[#00E599] hover:bg-[#00E599]/90 text-black font-black px-12 h-20 border-4 border-black rounded-none shadow-brutal-lg transition-all active:shadow-none active:translate-x-1 active:translate-y-1 text-xl uppercase italic">
                            {t("landing.cta.startBuilding")} <Rocket className="ml-3" size={24} strokeWidth={3} />
                        </Button>
                    </Link>
                    <Link href="/docs">
                        <Button variant="outline" size="lg" className="bg-white text-black border-4 border-black font-black px-12 h-20 rounded-none shadow-brutal-lg hover:bg-white/90 transition-all active:shadow-none active:translate-x-1 active:translate-y-1 text-xl uppercase italic">
                            {t("landing.cta.readDocs")} <FileText className="ml-3" size={24} strokeWidth={3} />
                        </Button>
                    </Link>
                    <Link href="/developer">
                        <Button variant="ghost" size="lg" className="text-black font-black px-12 h-20 rounded-none hover:bg-black hover:text-white transition-all text-xl uppercase italic group">
                            {t("landing.cta.tryPlayground")} <Play className="ml-3 group-hover:translate-x-2 transition-transform shadow-brutal-xs" size={24} strokeWidth={3} fill="currentColor" />
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Corner Decorations */}
            <div className="absolute top-0 left-0 w-32 h-32 border-r-8 border-b-8 border-black -translate-x-16 -translate-y-16 rotate-45" />
            <div className="absolute bottom-0 right-0 w-32 h-32 border-l-8 border-t-8 border-black translate-x-16 translate-y-16 rotate-45" />
        </section>
    );
}
