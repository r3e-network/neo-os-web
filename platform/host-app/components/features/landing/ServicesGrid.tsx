import React from "react";
import { ArrowRight, ShieldCheck, Dices, Lock, LineChart, BellRing, Fuel, EyeOff, Database } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

export function ServicesGrid() {
  const { t } = useTranslation("host");

  const SERVICES = [
    { key: "verifiedData", icon: ShieldCheck, color: "text-blue-400 bg-erobo-purple/10 border-blue-500/20" },
    { key: "fairPlay", icon: Dices, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
    { key: "personalVault", icon: Lock, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    { key: "liveInsights", icon: LineChart, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { key: "smartAlerts", icon: BellRing, color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
    { key: "gasSupport", icon: Fuel, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
    { key: "privacyShield", icon: EyeOff, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
    { key: "bridgeHub", icon: Database, color: "text-teal-400 bg-teal-500/10 border-teal-500/20" },
  ];

  return (
    <section className="py-24 px-4 bg-background relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-1/2 right-0 w-[800px] h-[800px] bg-erobo-purple/5 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />

      <div className="mx-auto max-w-7xl relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-erobo-ink dark:text-white mb-4 tracking-tight">
            {t("landing.services.title")}
          </h2>
          <p className="text-erobo-ink-soft dark:text-white/60 max-w-2xl mx-auto">{t("landing.services.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICES.map((service, idx) => {
            const Icon = service.icon;
            return (
              <div
                key={idx}
                className="group p-6 bg-white dark:bg-white/5 border border-erobo-purple/10 dark:border-white/10 rounded-2xl backdrop-blur-md shadow-lg transition-all hover:-translate-y-2 hover:border-erobo-purple/20 dark:hover:border-white/20 hover:shadow-xl hover:shadow-neo/5 flex flex-col h-full"
              >
                {/* Icon */}
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center mb-6 border ${service.color} shadow-[0_0_15px_rgba(255,255,255,0.05)] group-hover:scale-110 transition-transform`}
                >
                  <Icon size={28} strokeWidth={2} />
                </div>

                <div className="flex flex-col mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-erobo-ink dark:text-white tracking-tight">
                      {t(`landing.services.list.${service.key}.name`)}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-neo/10 text-neo text-[10px] font-bold uppercase tracking-wider border border-neo/20 rounded-full self-start">
                    <div className="w-1.5 h-1.5 bg-neo rounded-full animate-pulse shadow-[0_0_5px_#00E599]" />
                    {t("landing.services.active")}
                  </div>
                </div>

                <p className="text-sm font-medium text-erobo-ink-soft dark:text-white/50 mb-8 leading-relaxed flex-grow">
                  {t(`landing.services.list.${service.key}.desc`)}
                </p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-erobo-purple/10 dark:border-white/5">
                  <span className="text-[10px] font-bold uppercase text-erobo-ink-soft/60 dark:text-white/30 tracking-wider">
                    {t(`landing.services.list.${service.key}.requests`)} {t("landing.services.requests")}
                  </span>
                  <button className="p-2 rounded-full bg-erobo-purple/10 dark:bg-white/5 text-erobo-ink-soft dark:text-white border border-erobo-purple/10 dark:border-white/10 hover:bg-erobo-purple/15 dark:hover:bg-white/10 hover:scale-110 hover:border-erobo-purple/20 dark:hover:border-white/20 transition-all">
                    <ArrowRight size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
