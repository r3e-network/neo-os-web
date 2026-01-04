import React from "react";
import { ArrowRight, ShieldCheck, Dices, Lock, LineChart, BellRing, Fuel, EyeOff, Database } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

export function ServicesGrid() {
  const { t } = useTranslation("host");

  const SERVICES = [
    { key: "verifiedData", icon: ShieldCheck, color: "text-blue-500" },
    { key: "fairPlay", icon: Dices, color: "text-purple-500" },
    { key: "personalVault", icon: Lock, color: "text-amber-500" },
    { key: "liveInsights", icon: LineChart, color: "text-emerald-500" },
    { key: "smartAlerts", icon: BellRing, color: "text-rose-500" },
    { key: "gasSupport", icon: Fuel, color: "text-cyan-500" },
    { key: "privacyShield", icon: EyeOff, color: "text-indigo-500" },
    { key: "bridgeHub", icon: Database, color: "text-teal-500" },
  ];

  return (
    <section className="py-24 px-4 bg-gray-50 dark:bg-dark-950/40">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">{t("landing.services.title")}</h2>
          <p className="text-slate-400">{t("landing.services.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICES.map((service, idx) => {
            const Icon = service.icon;
            return (
              <div
                key={idx}
                className="group p-6 rounded-2xl bg-white dark:bg-dark-900/40 border border-gray-200 dark:border-white/5 hover:border-neo/30 transition-all hover:shadow-xl hover:shadow-neo/5"
              >
                {/* Icon */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${service.color} bg-current/10`}
                >
                  <Icon size={24} className={service.color} />
                </div>

                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-neo transition-colors">
                    {t(`landing.services.list.${service.key}.name`)}
                  </h3>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {t("landing.services.active")}
                  </div>
                </div>

                <p className="text-sm text-slate-400 mb-4">{t(`landing.services.list.${service.key}.desc`)}</p>

                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs font-medium text-slate-500">
                    {t(`landing.services.list.${service.key}.requests`)} {t("landing.services.requests")}
                  </span>
                  <button className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 text-slate-400 group-hover:text-neo group-hover:bg-neo/10 transition-all">
                    <ArrowRight size={16} />
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
