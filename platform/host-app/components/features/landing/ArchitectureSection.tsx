import React from "react";
import { CheckCircle2, Cpu, Shield, Layers } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

export function ArchitectureSection() {
    const { t } = useTranslation("host");

    return (
        <section className="py-24 px-4 bg-white dark:bg-dark-950 overflow-hidden">
            <div className="mx-auto max-w-7xl">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    {/* Left Content */}
                    <div>
                        <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
                            {t("landing.architecture.title")}
                        </h2>
                        <p className="text-lg text-slate-400 mb-10 leading-relaxed">
                            {t("landing.architecture.subtitle")}
                        </p>

                        <div className="space-y-6">
                            <ArchitectureItem
                                title={t("landing.architecture.rootTitle")}
                                description={t("landing.architecture.rootDesc")}
                            />
                            <ArchitectureItem
                                title={t("landing.architecture.osTitle")}
                                description={t("landing.architecture.osDesc")}
                            />
                            <ArchitectureItem
                                title={t("landing.architecture.appTitle")}
                                description={t("landing.architecture.appDesc")}
                            />
                        </div>
                    </div>

                    {/* Right Visual Stack */}
                    <div className="relative">
                        <div className="space-y-4 relative z-10">
                            {/* Trust Root Card */}
                            <div className="p-8 rounded-2xl bg-[#2a1a1a]/80 border border-rose-500/20 backdrop-blur-sm group hover:scale-[1.02] transition-transform">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl bg-rose-500/20 text-rose-500">
                                        <Cpu size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-rose-100 mb-1">{t("landing.architecture.teeTitle")}</h4>
                                        <p className="text-sm text-rose-200/50">{t("landing.architecture.teeSpecs")}</p>
                                    </div>
                                </div>
                            </div>

                            {/* ServiceOS Card */}
                            <div className="p-8 rounded-2xl bg-[#1a203a]/80 border border-blue-500/20 backdrop-blur-sm group hover:scale-[1.02] transition-transform">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400">
                                        <Shield size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-blue-100 mb-1">{t("landing.architecture.osLayerTitle")}</h4>
                                        <p className="text-sm text-blue-200/50">{t("landing.architecture.osLayerSpecs")}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Services Layer Card */}
                            <div className="p-8 rounded-2xl bg-[#1a2a1a]/80 border border-emerald-500/20 backdrop-blur-sm group hover:scale-[1.02] transition-transform">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
                                        <Layers size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-emerald-100 mb-1">{t("landing.architecture.servicesTitle")}</h4>
                                        <p className="text-sm text-emerald-200/50">{t("landing.architecture.servicesSpecs")}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Background Glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-neo/5 blur-[100px] -z-10 rounded-full" />
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
