"use client";

import { Code2, Database } from "lucide-react";
import { motion } from "framer-motion";
import { DeveloperCalloutCard } from "./DeveloperCalloutCard";

type DeveloperCalloutSectionProps = {
  onOpenBuilder: () => void;
};

export function DeveloperCalloutSection({
  onOpenBuilder,
}: DeveloperCalloutSectionProps) {
  return (
    <section className="py-12 px-4">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <DeveloperCalloutCard
              icon={Code2}
              title="Quick Start"
              subtitle="No-code + config-driven workflow"
              accentClassName="bg-gradient-to-br from-neo to-emerald-600"
              surfaceClassName="mt-6 bg-neo text-gray-900 font-semibold hover:bg-neo/90"
              codeLines={[
                "# Build from templates",
                "Generate JSON or YAML miniapp definition",
                "# Validate + save",
                "POST /api/miniapps/admin/definition-preview",
              ]}
              href="/docs"
              ctaLabel="Read Documentation"
              ctaVariant="docs"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <DeveloperCalloutCard
              icon={Database}
              title="Definition Builder"
              subtitle="JSON / YAML + template catalog"
              accentClassName="bg-gradient-to-br from-orange-500 to-red-600"
              surfaceClassName="bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold hover:from-orange-600 hover:to-red-700"
              description="Publish-like-article workflow: fill form, generate definition, preview, then save draft."
              bullets={[
                "Template type + template ID mapping",
                "Schema + runtime preview",
                "Banner/logo URL + variants ready",
              ]}
              ctaLabel="Open Builder"
              ctaVariant="builder"
              onClick={onOpenBuilder}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
