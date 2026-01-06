import React from "react";

type Props = {
  title: string;
  value: string | number;
  icon: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
};

export function AppStatsCard({ title, value, icon, trend, trendValue }: Props) {
  const getTrendStyles = () => {
    if (!trend) return "bg-gray-200 text-gray-500 border-gray-400";
    if (trend === "up") return "bg-neo text-black border-black";
    if (trend === "down") return "bg-brutal-red text-white border-black";
    return "bg-gray-200 text-black border-black";
  };

  const getTrendSymbol = () => {
    if (trend === "up") return "↑";
    if (trend === "down") return "↓";
    return "•";
  };

  return (
    <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0_#000] hover:shadow-[3px_3px_0_#000] hover:translate-x-[3px] hover:translate-y-[3px] transition-all duration-200 group relative overflow-hidden">
      {/* Texture Background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_1px_1px,#000_1px,transparent_0)] bg-[size:16px_16px]" />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="text-xl bg-white p-2 border-2 border-black shadow-[3px_3px_0_#000] group-hover:rotate-6 transition-transform">
            {icon}
          </div>
          {trendValue && (
            <div className={`text-[10px] font-black uppercase px-2 py-1 border-2 shadow-[2px_2px_0_#000] flex items-center gap-1 ${getTrendStyles()}`}>
              <span>{getTrendSymbol()} {trendValue}</span>
            </div>
          )}
        </div>

        <div className="text-4xl font-black tracking-tighter text-black mb-1 break-all leading-none">
          {value}
        </div>

        <div className="inline-block px-1 bg-black text-white text-[10px] font-black uppercase tracking-widest">
          {title}
        </div>
      </div>
    </div>
  );
}
