import React from "react";
import { Shield, Lock, Eye, Zap, Cpu, Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

export function SecurityFeatures() {
    const { t } = useTranslation("host");

    const FEATURES = [
        {
            icon: Shield,
            key: "privacy",
        },
        {
            icon: Lock,
            key: "storage",
        },
        {
            icon: Eye,
            key: "authenticity",
        },
        {
            icon: Zap,
            key: "fairness",
        },
        {
            icon: Cpu,
            key: "automation",
        },
        {
            icon: Globe,
            key: "connectivity",
        },
    ];

    return (
        <section className="py-24 px-4 bg-white dark:bg-dark-950">
            <div className="mx-auto max-w-7xl">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
                        {t("landing.security.title")}
                    </h2>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                        {t("landing.security.subtitle")}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {FEATURES.map((feature, idx) => (
                        <div
                            key={idx}
                            className="p-8 rounded-2xl bg-gray-50 dark:bg-dark-900/30 border border-gray-100 dark:border-white/5 hover:border-indigo-500/20 transition-all hover:-translate-y-1"
                        >
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-6">
                                <feature.icon size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                                {t(`landing.security.list.${feature.key}.title`)}
                            </h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                {t(`landing.security.list.${feature.key}.desc`)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
