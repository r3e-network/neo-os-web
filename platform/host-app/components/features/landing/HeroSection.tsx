import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WaterWaveBackground } from "@/components/ui/WaterWaveBackground";
import { Rocket, FileText, Code2, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n/react";

export function HeroSection() {
  const { t } = useTranslation("host");

  return (
    <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 bg-background">
      {/* E-Robo Water Wave Background */}
      <WaterWaveBackground intensity="medium" colorScheme="mixed" className="-z-10" />

      {/* Additional decorative elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(rgba(159,157,243,0.1)_1px,transparent_0)] bg-[size:40px_40px] opacity-30" />
      </div>

      <div className="mx-auto max-w-7xl px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-erobo-purple/10 text-erobo-purple text-xs font-bold uppercase tracking-widest border border-erobo-purple/30 rounded-full mb-10 shadow-[0_0_15px_rgba(159,157,243,0.3)] backdrop-blur-md">
            <div className="w-2 h-2 bg-erobo-purple rounded-full animate-pulse shadow-[0_0_10px_rgba(159,157,243,0.7)]" />
            {t("hero.badge")}
          </div>

          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold text-gray-900 dark:text-white mb-10 tracking-tight leading-[1.1]">
            {t("hero.title")} <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-erobo-purple to-erobo-pink inline-block mt-2 drop-shadow-2xl">
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
                className="bg-gradient-to-r from-erobo-purple to-erobo-pink text-white font-bold px-10 h-16 rounded-full border border-white/30 shadow-[0_0_30px_rgba(159,157,243,0.35)] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(159,157,243,0.45)] text-lg"
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
              <span className="font-bold tracking-tight text-lg bg-clip-text text-transparent bg-gradient-to-r from-gray-700 to-gray-900 dark:from-white dark:to-white/70">{t("hero.sgxEnabled")}</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
            <div className="flex items-center gap-2">
              <Shield size={20} />
              <span className="font-bold tracking-tight text-lg bg-clip-text text-transparent bg-gradient-to-r from-gray-700 to-gray-900 dark:from-white dark:to-white/70">{t("hero.teeTrusted")}</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
            <div className="flex items-center gap-2 text-[#00E599]">
              <Rocket size={20} />
              <span className="font-bold tracking-tight text-lg text-[#00E599] dropshadow-neo">{t("hero.neoNative")}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
