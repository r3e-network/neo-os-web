import { Shield, Zap, Globe, Cpu } from "lucide-react";
import { FeatureItem } from "@/components/features/home/FeatureItem";

export function FeaturesGridSection({
  t,
}: {
  t: (key: string, ns?: "common" | "host" | "admin" | "miniapp") => string;
}) {
  return (
    <section className="bg-[#f6f8fb] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8">
          <h2 className="m-0 text-2xl font-black text-gray-900 md:text-3xl">
            {t("home.capabilities.title", "host")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            {t("home.capabilities.description", "host")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FeatureItem
            icon={Shield}
            title={t("home.capabilities.teeTitle", "host")}
            desc={t("home.capabilities.teeDesc", "host")}
          />
          <FeatureItem
            icon={Zap}
            title={t("home.capabilities.vrfTitle", "host")}
            desc={t("home.capabilities.vrfDesc", "host")}
          />
          <FeatureItem
            icon={Globe}
            title={t("home.capabilities.oracleTitle", "host")}
            desc={t("home.capabilities.oracleDesc", "host")}
          />
          <FeatureItem
            icon={Cpu}
            title={t("home.capabilities.storageTitle", "host")}
            desc={t("home.capabilities.storageDesc", "host")}
          />
        </div>
      </div>
    </section>
  );
}
