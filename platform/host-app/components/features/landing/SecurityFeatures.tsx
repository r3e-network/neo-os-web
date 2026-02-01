import React from "react";
import { Shield, Lock, Eye, Zap, Cpu, Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

export function SecurityFeatures() {
    const { t } = useTranslation("host");

    const FEATURES = [
        { icon: Shield, key: "privacy", gradient: "from-emerald-500/20 to-teal-500/20", text: "text-emerald-400" },
        { icon: Lock, key: "storage", gradient: "from-amber-500/20 to-orange-500/20", text: "text-amber-400" },
        { icon: Eye, key: "authenticity", gradient: "from-indigo-500/20 to-purple-500/20", text: "text-indigo-400" },
        { icon: Zap, key: "fairness", gradient: "from-cyan-500/20 to-blue-500/20", text: "text-cyan-400" },
        { icon: Cpu, key: "automation", gradient: "from-rose-500/20 to-pink-500/20", text: "text-rose-400" },
        { icon: Globe, key: "connectivity", gradient: "from-violet-500/20 to-fuchsia-500/20", text: "text-violet-400" },
    ];

    return (
        <section className="py-24 px-4 bg-background relative overflow-hidden">
            {/* Ambient Glow */}
            <div className="absolute inset-0 bg-neo/5 filter blur-[100px] pointer-events-none opacity-50" />

            <div className="mx-auto max-w-7xl relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 leading-tight">
                        {t("landing.security.title")}
                    </h2>
                    <p className="text-lg text-gray-600 dark:text-white/60 max-w-2xl mx-auto font-medium">
                        {t("landing.security.subtitle")}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {FEATURES.map((feature, idx) => (
                        <div
                            key={idx}
                            className="p-8 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl backdrop-blur-md shadow-lg transition-all hover:-translate-y-2 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-xl hover:shadow-neo/5 group"
                        >
                            <div
                                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 border border-gray-200 dark:border-white/10 bg-gradient-to-br ${feature.gradient} shadow-inner group-hover:scale-110 transition-transform`}
                            >
                                <feature.icon size={24} className={feature.text} strokeWidth={2.5} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
                                {t(`landing.security.list.${feature.key}.title`)}
                            </h3>
                            <p className="text-sm font-medium text-gray-500 dark:text-white/50 leading-relaxed">
                                {t(`landing.security.list.${feature.key}.desc`)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
