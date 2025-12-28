"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export interface MiniAppInfo {
  app_id: string;
  name: string;
  description: string;
  icon: string;
  category: "gaming" | "defi" | "social" | "governance" | "utility";
  stats?: {
    users?: number;
    transactions?: number;
    volume?: string;
  };
}

const categoryColors = {
  gaming: "bg-purple-100 text-purple-800",
  defi: "bg-blue-100 text-blue-800",
  social: "bg-pink-100 text-pink-800",
  governance: "bg-amber-100 text-amber-800",
  utility: "bg-gray-100 text-gray-800",
};

export function MiniAppCard({ app }: { app: MiniAppInfo }) {
  return (
    <Link href={`/app/${app.app_id}`}>
      <Card className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-3xl">{app.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 truncate">{app.name}</h3>
                <Badge className={categoryColors[app.category]} variant="secondary">
                  {app.category}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">{app.description}</p>
            </div>
          </div>
          {app.stats && (
            <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
              {app.stats.users && <span>{app.stats.users.toLocaleString()} users</span>}
              {app.stats.transactions && <span>{app.stats.transactions.toLocaleString()} txs</span>}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
