import React from "react";
import { Shield, Lock, Eye, Zap, Cpu, Globe } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

export function SecurityFeatures() {
    const { t } = useTranslation("host");

    const FEATURES = [
        { icon: Shield, key: "privacy", color: "#00E599" },
        { icon: Lock, key: "storage", color: "#ffde59" },
        { icon: Eye, key: "authenticity", color: "#ff7e7e" },
        { icon: Zap, key: "fairness", color: "#00E599" },
        { icon: Cpu, key: "automation", color: "#ffde59" },
        { icon: Globe, key: "connectivity", color: "#ff7e7e" },
    ];

    return (
        <section className="py-24 px-4 bg-white dark:bg-dark-950">
            <div className="mx-auto max-w-7xl">
                <div className="text-center mb-16">
                    <h2 className="text-5xl font-black text-black dark:text-white mb-6 uppercase italic tracking-tighter leading-none">
                        {t("landing.security.title")}
                    </h2>
                    <p className="text-xl font-bold text-slate-600 dark:text-slate-400 max-w-2xl mx-auto uppercase tracking-wide">
                        {t("landing.security.subtitle")}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {FEATURES.map((feature, idx) => (
                        <div
                            key={idx}
                            className="p-10 bg-white dark:bg-dark-900 border-4 border-black shadow-brutal-lg hover:-translate-y-2 transition-all relative overflow-hidden group"
                        >
                            <div
                                className="w-16 h-16 border-4 border-black flex items-center justify-center mb-8 shadow-brutal-sm group-hover:rotate-12 transition-transform"
                                style={{ backgroundColor: feature.color }}
                            >
                                <feature.icon size={32} className="text-black" />
                            </div>
                            <h3 className="text-2xl font-black text-black dark:text-white mb-4 uppercase italic tracking-tighter">
                                {t(`landing.security.list.${feature.key}.title`)}
                            </h3>
                            <p className="text-md font-bold text-slate-600 dark:text-slate-400 leading-tight uppercase">
                                {t(`landing.security.list.${feature.key}.desc`)}
                            </p>

                            {/* Decorative Corner */}
                            <div className="absolute top-0 right-0 w-8 h-8 bg-black rotate-45 translate-x-4 -translate-y-4" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
