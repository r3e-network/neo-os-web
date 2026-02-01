import React from "react";
import { Cpu, Shield, Layers, Lock, Eye, Zap, Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

const FEATURES = [
  { icon: Shield, key: "privacy" },
  { icon: Lock, key: "storage" },
  { icon: Eye, key: "authenticity" },
  { icon: Zap, key: "fairness" },
  { icon: Cpu, key: "automation" },
  { icon: Globe, key: "connectivity" },
];

export function ArchitectureSection() {
  const { t } = useTranslation("host");

  return (
    <section className="py-24 px-4 bg-background relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-neo/10 blur-[100px] rounded-full pointer-events-none translate-y-1/3" />

      <div className="mx-auto max-w-7xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <div className="bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 p-10 rounded-3xl backdrop-blur-xl shadow-2xl">
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
              {t("landing.security.title")}
            </h2>
            <p className="text-lg text-gray-600 dark:text-white/60 mb-10 leading-relaxed font-medium">
              {t("landing.security.subtitle")}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FEATURES.map((feature, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 p-4 border border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/5 rounded-xl transition-all hover:bg-gray-100 dark:hover:bg-white/10 hover:border-gray-300 dark:hover:border-white/10 group"
                >
                  <div className="p-2.5 rounded-full bg-neo/10 text-neo border border-neo/20 shadow-[0_0_10px_rgba(0,229,153,0.1)] group-hover:shadow-[0_0_15px_rgba(0,229,153,0.3)] transition-shadow">
                    <feature.icon size={20} />
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">
                    {t(`landing.security.list.${feature.key}.title`)}
                  </h4>
                </div>
              ))}
            </div>
          </div>

          {/* Right Visual Stack - Architecture View */}
          <div className="relative pl-8">
            <div className="space-y-6 relative z-10">
              {/* Vertical connection line */}
              <div className="absolute left-[3.25rem] top-10 bottom-10 w-0.5 bg-gradient-to-b from-transparent via-white/20 to-transparent -z-10" />

              {/* Trust Root Card */}
              <div className="p-6 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-2xl backdrop-blur-md shadow-lg transition-transform hover:-translate-y-1 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-xl hover:shadow-red-500/5 group">
                <div className="flex items-center gap-6">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/5 border border-red-500/20 text-red-400 group-hover:text-red-300 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                    <Cpu size={28} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-red-400 transition-colors">
                      {t("landing.architecture.teeTitle")}
                    </h4>
                    <p className="text-sm font-medium text-gray-500 dark:text-white/50">
                      {t("landing.architecture.teeSpecs")}
                    </p>
                  </div>
                </div>
              </div>

              {/* ServiceOS Card */}
              <div className="p-6 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-2xl backdrop-blur-md shadow-lg transition-transform hover:-translate-y-1 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-xl hover:shadow-neo/5 group">
                <div className="flex items-center gap-6">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-neo/20 to-emerald-600/5 border border-neo/20 text-neo group-hover:text-emerald-300 transition-colors shadow-[0_0_20px_rgba(0,229,153,0.1)]">
                    <Shield size={28} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-neo transition-colors">
                      {t("landing.architecture.osLayerTitle")}
                    </h4>
                    <p className="text-sm font-medium text-gray-500 dark:text-white/50">
                      {t("landing.architecture.osLayerSpecs")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Services Layer Card */}
              <div className="p-6 bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-2xl backdrop-blur-md shadow-lg transition-transform hover:-translate-y-1 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-xl hover:shadow-yellow-500/5 group">
                <div className="flex items-center gap-6">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-600/5 border border-yellow-500/20 text-yellow-400 group-hover:text-yellow-300 transition-colors shadow-[0_0_20px_rgba(234,179,8,0.1)]">
                    <Layers size={28} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-yellow-400 transition-colors">
                      {t("landing.architecture.servicesTitle")}
                    </h4>
                    <p className="text-sm font-medium text-gray-500 dark:text-white/50">
                      {t("landing.architecture.servicesSpecs")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


