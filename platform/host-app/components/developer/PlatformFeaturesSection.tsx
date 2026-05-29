"use client";

import type { LucideIcon } from "lucide-react";
import { IconFeatureGrid } from "@/components/content";

type PlatformFeatureItem = {
  icon: LucideIcon;
  title: string;
  description: string;
  colorClass: string;
};

type PlatformFeaturesSectionProps = {
  items: PlatformFeatureItem[];
};

export function PlatformFeaturesSection({
  items,
}: PlatformFeaturesSectionProps) {
  return (
    <section className="py-12 px-4">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">
          Platform Features
        </h2>
        <IconFeatureGrid columns={4} items={items} />
      </div>
    </section>
  );
}
