import React from "react";
import { CheckCircle2, Cpu, Shield, Layers, Lock, Eye, Zap, Globe } from "lucide-react";
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
        <section className="py-24 px-4 bg-white dark:bg-dark-950 overflow-hidden">
            <div className="mx-auto max-w-7xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    {/* Left Content */}
                    <div className="bg-white dark:bg-dark-900 border-4 border-black p-10 shadow-brutal-lg">
                        <h2 className="text-5xl font-black tracking-tighter text-black dark:text-white mb-8 uppercase italic leading-none">
                            {t("landing.security.title")}
                        </h2>
                        <p className="text-xl font-bold text-slate-600 dark:text-slate-300 mb-12 leading-tight uppercase">
                            {t("landing.security.subtitle")}
                        </p>

                        <div className="space-y-4">
                            {FEATURES.map((feature, idx) => (
                                <div key={idx} className="flex items-center gap-6 p-4 border-4 border-black bg-[#ffde59] shadow-brutal-sm hover:translate-x-1 hover:-translate-y-1 transition-transform">
                                    <div className="p-3 bg-black text-white border-2 border-black">
                                        <feature.icon size={24} />
                                    </div>
                                    <h4 className="text-lg font-black text-black uppercase italic">{t(`landing.security.list.${feature.key}.title`)}</h4>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Visual Stack - Architecture View */}
                    <div className="relative">
                        <div className="space-y-6 relative z-10">
                            {/* Trust Root Card */}
                            <div className="p-10 bg-white border-4 border-black shadow-brutal-lg rotate-1 hover:rotate-0 transition-transform">
                                <div className="flex items-start gap-6">
                                    <div className="p-4 bg-[#ff4d4d] border-4 border-black text-black">
                                        <Cpu size={32} />
                                    </div>
                                    <div>
                                        <h4 className="text-2xl font-black text-black mb-1 uppercase italic tracking-tighter">{t("landing.architecture.teeTitle")}</h4>
                                        <p className="text-md font-bold text-slate-600 uppercase tracking-widest">{t("landing.architecture.teeSpecs")}</p>
                                    </div>
                                </div>
                            </div>

                            {/* ServiceOS Card */}
                            <div className="p-10 bg-white border-4 border-black shadow-brutal-lg -rotate-1 hover:rotate-0 transition-transform">
                                <div className="flex items-start gap-6">
                                    <div className="p-4 bg-[#00E599] border-4 border-black text-black">
                                        <Shield size={32} />
                                    </div>
                                    <div>
                                        <h4 className="text-2xl font-black text-black mb-1 uppercase italic tracking-tighter">{t("landing.architecture.osLayerTitle")}</h4>
                                        <p className="text-md font-bold text-slate-600 uppercase tracking-widest">{t("landing.architecture.osLayerSpecs")}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Services Layer Card */}
                            <div className="p-10 bg-white border-4 border-black shadow-brutal-lg rotate-1 hover:rotate-0 transition-transform">
                                <div className="flex items-start gap-6">
                                    <div className="p-4 bg-[#ffde59] border-4 border-black text-black">
                                        <Layers size={32} />
                                    </div>
                                    <div>
                                        <h4 className="text-2xl font-black text-black mb-1 uppercase italic tracking-tighter">{t("landing.architecture.servicesTitle")}</h4>
                                        <p className="text-md font-bold text-slate-600 uppercase tracking-widest">{t("landing.architecture.servicesSpecs")}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Background Decoration */}
                        <div className="absolute inset-0 bg-black/5 dark:bg-white/5 border-8 border-dashed border-black/10 dark:border-white/10 -m-8 -z-10" />
                    </div>
                </div>
            </div>
        </section>
    );
}

function ArchitectureItem({ title, description }: { title: string; description: string }) {
    return (
        <div className="flex items-start gap-4">
            <div className="mt-1">
                <CheckCircle2 className="text-neo h-5 w-5" />
            </div>
            <div>
                <h4 className="font-bold text-gray-900 dark:text-white">{title}</h4>
                <p className="text-sm text-slate-500">{description}</p>
            </div>
        </div>
    );
}
