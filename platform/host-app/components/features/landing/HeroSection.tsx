import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WaterBackground } from "@/components/ui/WaterBackground";
import { Rocket, FileText, Code2, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n/react";

export function HeroSection() {
  const { t } = useTranslation("host");

  return (
    <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 bg-background">
      {/* E-Robo Water Wave Background */}
      <WaterBackground intensity="medium" className="-z-10" />

      {/* Additional decorative elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_0)] bg-[size:32px_32px] opacity-20" />
      </div>

      <div className="mx-auto max-w-7xl px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-neo/10 text-neo text-xs font-bold uppercase tracking-widest border border-neo/20 rounded-full mb-10 shadow-[0_0_15px_rgba(0,229,153,0.3)] backdrop-blur-md">
            <div className="w-2 h-2 bg-neo rounded-full animate-pulse shadow-[0_0_10px_#00E599]" />
            {t("hero.badge")}
          </div>

          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold text-gray-900 dark:text-white mb-10 tracking-tight leading-[1.1]">
            {t("hero.title")} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neo to-blue-500 inline-block mt-2 drop-shadow-2xl">
              {t("hero.titleHighlight")}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 dark:text-white/60 max-w-3xl mx-auto mb-16 leading-normal font-medium tracking-tight">
            {t("hero.subtitle")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="#explore">
              <Button
                size="lg"
                className="bg-neo hover:bg-neo/90 text-black font-bold px-10 h-16 rounded-full border border-neo/50 shadow-[0_0_20px_rgba(0,229,153,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(0,229,153,0.6)] text-lg"
              >
                {t("hero.exploreApps")} <Rocket className="ml-2" size={20} strokeWidth={2.5} />
              </Button>
            </Link>
            <Link href="/docs">
              <Button
                variant="outline"
                size="lg"
                className="border border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold px-10 h-16 rounded-full backdrop-blur-md hover:bg-gray-200 dark:hover:bg-white/10 transition-all hover:scale-105 text-lg"
              >
                {t("hero.howItWorks")} <FileText className="ml-2" size={20} strokeWidth={2.5} />
              </Button>
            </Link>
          </div>

          {/* Tech stack badges */}
          <div className="mt-20 flex flex-wrap justify-center items-center gap-8 text-gray-500 dark:text-white/50 transition-all duration-700">
            <div className="flex items-center gap-2">
              <Code2 size={20} />
              <span className="font-medium tracking-tight text-lg">{t("hero.sgxEnabled")}</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
            <div className="flex items-center gap-2">
              <Shield size={20} />
              <span className="font-medium tracking-tight text-lg">{t("hero.teeTrusted")}</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
            <div className="flex items-center gap-2">
              <Rocket size={20} />
              <span className="font-medium tracking-tight text-lg">{t("hero.neoNative")}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
