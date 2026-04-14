"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OAuthBindingItemProps = {
  provider: { id: string; name: string; icon: string };
  account?: { email?: string; name?: string };
  isLoading: boolean;
  onLink: () => void;
  onUnlink: () => void;
};

export function OAuthBindingItem({
  provider,
  account,
  isLoading,
  onLink,
  onUnlink,
}: OAuthBindingItemProps) {
  const isConnected = Boolean(account);

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-100 p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{provider.icon}</span>
        <div>
          <p className="text-sm font-medium text-gray-900">{provider.name}</p>
          {isConnected && account ? (
            <p className="text-xs text-gray-500">{account.email || account.name}</p>
          ) : (
            <p className="text-xs text-gray-500">Not connected</p>
          )}
        </div>
      </div>
      <Button
        variant={isConnected ? "outline" : "primary"}
        size="sm"
        onClick={isConnected ? onUnlink : onLink}
        disabled={isLoading}
        className={cn(
          "h-8 text-xs",
          isConnected
            ? "border-gray-200 text-gray-500 transition-colors hover:border-red-400/30 hover:text-red-400"
            : "bg-neo hover:bg-neo/90",
        )}
      >
        {isLoading ? "..." : isConnected ? "Disconnect" : "Connect"}
      </Button>
    </div>
  );
}
