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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {SERVICES.map((service, idx) => {
            const Icon = service.icon;
            return (
              <div
                key={idx}
                className="group p-8 rounded-none bg-white dark:bg-black border-4 border-black dark:border-white shadow-brutal-md hover:shadow-brutal-lg hover:-translate-x-1 hover:-translate-y-1 transition-all"
              >
                {/* Icon */}
                <div
                  className={`w-16 h-16 rounded-none flex items-center justify-center mb-6 border-4 border-black ${service.color.replace('text-', 'bg-').split(' ')[0]} bg-opacity-100 rotate-3 group-hover:rotate-0 transition-transform`}
                >
                  <Icon size={32} className="text-black" strokeWidth={3} />
                </div>

                <div className="flex flex-col mb-4">
                  <h3 className="text-2xl font-black text-black dark:text-white mb-2 uppercase tracking-tighter italic">
                    {t(`landing.services.list.${service.key}.name`)}
                  </h3>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-neo text-black text-[10px] font-black uppercase tracking-wider border-2 border-black inline-block self-start">
                    <div className="w-1.5 h-1.5 bg-black animate-pulse" />
                    {t("landing.services.active")}
                  </div>
                </div>

                <p className="text-sm font-bold text-black/60 dark:text-white/60 mb-8 leading-snug">{t(`landing.services.list.${service.key}.desc`)}</p>

                <div className="flex items-center justify-between mt-auto border-t-2 border-black/10 pt-4">
                  <span className="text-[10px] font-black uppercase text-black/40">
                    {t(`landing.services.list.${service.key}.requests`)} {t("landing.services.requests")}
                  </span>
                  <button className="p-3 bg-black text-white border-2 border-black hover:bg-neo hover:text-black transition-all">
                    <ArrowRight size={20} strokeWidth={3} />
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
