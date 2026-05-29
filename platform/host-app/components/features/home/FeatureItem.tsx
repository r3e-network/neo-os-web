import { type ComponentType } from "react";
import { Card } from "@/components/ui/card";

export function FeatureItem({
  icon: Icon,
  title,
  desc,
}: {
  icon: ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Card className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-neo/40 hover:shadow-md">
      <div className="relative z-10 mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-900 transition-colors group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-700">
        <Icon size={26} aria-hidden="true" />
      </div>
      <h3 className="relative z-10 mb-3 text-lg font-bold text-gray-900">
        {title}
      </h3>
      <p className="relative z-10 text-sm font-medium leading-6 text-gray-600">
        {desc}
      </p>
    </Card>
  );
}
