/**
 * Wishlist Page - User's saved apps
 */

import Head from "next/head";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Heart, Trash2 } from "lucide-react";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";
import { useWalletStore } from "@/lib/wallet/store";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/react";
import { formatTimeAgo } from "@/lib/utils";

interface WishlistItem {
  app_id: string;
  created_at: string;
}

export default function WishlistPage() {
  const { t } = useTranslation("host");
  const { address } = useWalletStore();
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch("/api/user/wishlist", {
        headers: { "x-wallet-address": address },
      });
      const data = await res.json();
      setWishlist(data.wishlist || []);
    } catch (err) {
      console.error("Failed to fetch wishlist:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const removeFromWishlist = async (appId: string) => {
    if (!address) return;
    try {
      await fetch("/api/user/wishlist", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": address,
        },
        body: JSON.stringify({ app_id: appId }),
      });
      setWishlist((prev) => prev.filter((w) => w.app_id !== appId));
    } catch (err) {
      console.error("Failed to remove:", err);
    }
  };

  if (!address) {
    return (
      <Layout>
        <Head>
          <title>{t("wishlist.pageTitle")}</title>
        </Head>
        <EmptyState type="connect" t={t} />
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>{t("wishlist.pageTitle")}</title>
      </Head>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Header count={wishlist.length} t={t} />

        {loading ? (
          <LoadingSkeleton />
        ) : wishlist.length === 0 ? (
          <EmptyState type="empty" t={t} />
        ) : (
          <WishlistGrid wishlist={wishlist} onRemove={removeFromWishlist} t={t} />
        )}
      </div>
    </Layout>
  );
}

function Header({ count, t }: { count: number; t: any }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className="w-12 h-12 rounded-xl bg-erobo-purple/10 flex items-center justify-center border border-erobo-purple/20">
        <Heart className="text-erobo-purple" size={24} />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-erobo-ink dark:text-white">{t("wishlist.title")}</h1>
        <p className="text-erobo-ink-soft/70 dark:text-white/60">{t("wishlist.appsSaved", { count })}</p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ type, t }: { type: "connect" | "empty"; t: any }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center">
        <Heart size={64} className="mx-auto mb-4 text-erobo-purple/30" />
        <h2 className="text-xl font-bold text-erobo-ink dark:text-white mb-2">
          {type === "connect" ? t("wishlist.connectWallet") : t("wishlist.noApps")}
        </h2>
        <p className="text-erobo-ink-soft/70 dark:text-white/60 mb-6">
          {type === "connect" ? t("wishlist.connectWalletDesc") : t("wishlist.noAppsDesc")}
        </p>
        {type === "empty" && (
          <Link href="/miniapps">
            <Button className="bg-erobo-purple hover:bg-erobo-purple-dark text-white">
              {t("wishlist.browseApps")}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function WishlistGrid({
  wishlist,
  onRemove,
  t,
}: {
  wishlist: WishlistItem[];
  onRemove: (appId: string) => void;
  t: any;
}) {
  return (
    <div className="grid gap-4">
      {wishlist.map((item) => (
        <WishlistCard key={item.app_id} item={item} onRemove={() => onRemove(item.app_id)} t={t} />
      ))}
    </div>
  );
}

function WishlistCard({ item, onRemove, t }: { item: WishlistItem; onRemove: () => void; t: any }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/80 dark:bg-white/5 border border-white/60 dark:border-white/10 hover:border-erobo-purple/40 transition-all backdrop-blur-sm">
      <Link href={`/miniapps/${item.app_id}`} className="flex-1 flex items-center gap-4">
        <MiniAppLogo appId={item.app_id} category="utility" size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-erobo-ink dark:text-white truncate">{item.app_id}</h3>
          <p className="text-sm text-erobo-ink-soft/70 dark:text-white/60">
            {t("wishlist.added")} {formatTimeAgo(item.created_at)}
          </p>
        </div>
      </Link>
      <button
        onClick={onRemove}
        className="p-2 text-erobo-ink-soft/50 dark:text-white/40 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

export const getServerSideProps = async () => ({ props: {} });
