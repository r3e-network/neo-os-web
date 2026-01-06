import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Rocket, FileText, Play, Code2, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n/react";

export function HeroSection() {
    const { t } = useTranslation("host");

    return (
        <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
            {/* Background decoration */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-neo/10 blur-[130px] rounded-full animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[130px] rounded-full animate-pulse-slow" />
            </div>

            <div className="mx-auto max-w-7xl px-4 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-neo text-black text-xs font-black uppercase tracking-widest border-2 border-black shadow-brutal-xs mb-10 rotate-[-1deg]">
                        <div className="w-2.5 h-2.5 bg-black animate-pulse" />
                        {t("hero.badge")}
                    </div>

                    <h1 className="text-6xl md:text-8xl lg:text-9xl font-black text-black dark:text-white mb-10 tracking-tighter leading-[0.9] uppercase italic">
                        {t("hero.title")} <br />
                        <span className="text-neo bg-black px-4 py-2 border-4 border-black inline-block mt-4 rotate-1 shadow-brutal-md">
                            {t("hero.titleHighlight")}
                        </span>
                    </h1>

                    <p className="text-xl md:text-2xl text-black/60 dark:text-white/60 max-w-3xl mx-auto mb-16 leading-tight font-black uppercase tracking-tight">
                        {t("hero.subtitle")}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-8">
                        <Link href="#explore">
                            <Button size="lg" className="bg-neo hover:bg-neo/90 text-black font-black px-12 h-20 rounded-none border-4 border-black shadow-brutal-lg transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-brutal-md text-xl uppercase italic">
                                {t("hero.exploreApps")} <Rocket className="ml-3" size={24} strokeWidth={3} />
                            </Button>
                        </Link>
                        <Link href="/docs">
                            <Button variant="outline" size="lg" className="border-4 border-black bg-white text-black font-black px-12 h-20 rounded-none shadow-brutal-lg hover:bg-gray-100 transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-brutal-md text-xl uppercase italic">
                                {t("hero.howItWorks")} <FileText className="ml-3" size={24} strokeWidth={3} />
                            </Button>
                        </Link>
                    </div>

                    {/* Tech stack badges */}
                    <div className="mt-20 flex flex-wrap justify-center items-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                        <div className="flex items-center gap-2">
                            <Code2 size={24} />
                            <span className="font-bold tracking-tighter text-xl">{t("hero.sgxEnabled")}</span>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        <div className="flex items-center gap-2">
                            <Shield size={24} />
                            <span className="font-bold tracking-tighter text-xl">{t("hero.teeTrusted")}</span>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        <div className="flex items-center gap-2">
                            <Rocket size={24} />
                            <span className="font-bold tracking-tighter text-xl">{t("hero.neoNative")}</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
