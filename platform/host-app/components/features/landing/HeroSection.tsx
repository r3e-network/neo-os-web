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
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-wider border border-emerald-500/20 mb-8 backdrop-blur-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {t("hero.badge")}
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-gray-900 dark:text-white mb-8 tracking-tight leading-[1.1]">
                        {t("hero.title")} <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-neo via-emerald-400 to-indigo-500">
                            {t("hero.titleHighlight")}
                        </span>
                    </h1>

                    <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
                        {t("hero.subtitle")}
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-5">
                        <Link href="#explore">
                            <Button size="lg" className="bg-neo hover:bg-neo/90 text-dark-950 font-bold px-10 h-16 rounded-2xl shadow-2xl shadow-neo/30 transition-all hover:scale-105">
                                {t("hero.exploreApps")} <Rocket className="ml-2" size={20} />
                            </Button>
                        </Link>
                        <Link href="/docs">
                            <Button variant="outline" size="lg" className="border-gray-300 dark:border-white/10 bg-white/80 dark:bg-white/5 backdrop-blur-sm text-gray-900 dark:text-white font-bold px-10 h-16 rounded-2xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
                                {t("hero.howItWorks")} <FileText className="ml-2" size={20} />
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
