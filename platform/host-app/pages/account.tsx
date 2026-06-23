import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { Layout, PageHero } from "@/components/layout";
import {
  AccountInfoRow,
  OAuthBindingItem,
} from "@/components/features/account";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Check, Link2, Shield, Wallet } from "lucide-react";
import {
  selectConnectedWalletAddress,
  useWalletStore,
} from "@/lib/wallet/store";
import { oauthProviders, useOAuthStore } from "@/lib/oauth/store";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/react";

export default function AccountPage() {
  const { t } = useI18n();
  const address = useWalletStore(selectConnectedWalletAddress);
  const { accounts, loading, linkAccount, unlinkAccount } = useOAuthStore();
  const [addressCopied, setAddressCopied] = useState(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current !== null) {
        clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

  const connectedProviders = accounts.length;
  const walletStatus = address
    ? t("account.connected", "host")
    : t("account.notConnected", "host");
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "—";

  const handleCopyAddress = () => {
    if (!address) return;
    navigator.clipboard
      .writeText(address)
      .then(() => {
        setAddressCopied(true);
        if (copyResetTimer.current !== null) {
          clearTimeout(copyResetTimer.current);
        }
        copyResetTimer.current = setTimeout(() => {
          copyResetTimer.current = null;
          setAddressCopied(false);
        }, 2000);
      })
      .catch((e: unknown) => {
        console.warn(
          "[account] clipboard write failed:",
          e instanceof Error ? e.message : String(e),
        );
      });
  };

  return (
    <Layout>
      <Head>
        <title>{`${t("account.pageTitle", "host")} - ${BRAND.productName}`}</title>
      </Head>

      <div className="pb-16 pt-20">
        <PageHero
          eyebrow={t("account.eyebrow", "host")}
          title={t("account.heroTitle", "host")}
          description={t("account.heroDescription", "host")}
          stats={[
            {
              label: t("account.statWallet", "host"),
              value: walletStatus,
              hint: shortAddress,
            },
            {
              label: t("account.statLinkedSocials", "host"),
              value: String(connectedProviders),
              hint: t("account.statLinkedSocialsHint", "host"),
            },
          ]}
        />

        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="space-y-8 md:col-span-2">
              <Card className="glass-card overflow-hidden">
                <CardHeader className="border-b border-gray-200 bg-neo/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-gray-900">
                        {t("account.walletCardTitle", "host")}
                      </CardTitle>
                      <CardDescription>
                        {t("account.walletCardDescription", "host")}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        address
                          ? "border-neo/20 bg-neo/10 text-neo"
                          : "border-gray-200 bg-gray-100 text-gray-500",
                      )}
                    >
                      {walletStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neo/20">
                      <Wallet
                        className="text-neo"
                        size={24}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-500">
                        {t("account.walletAddress", "host")}
                      </p>
                      <p className="truncate text-lg font-mono text-gray-900">
                        {shortAddress}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "text-gray-500 hover:text-gray-900",
                        addressCopied && "text-neo hover:text-neo",
                      )}
                      disabled={!address}
                      onClick={handleCopyAddress}
                    >
                      {addressCopied && (
                        <Check
                          size={14}
                          className="mr-1.5 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      {addressCopied ? t("actions.copied") : t("actions.copy")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-gray-900">
                    {t("account.socialTitle", "host")}
                  </CardTitle>
                  <CardDescription>
                    {t("account.socialDescription", "host")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {oauthProviders.map((provider) => {
                    const account = accounts.find(
                      (item) => item.provider === provider.id,
                    );
                    const isLoading = loading === provider.id;

                    return (
                      <OAuthBindingItem
                        key={provider.id}
                        provider={provider}
                        account={account}
                        isLoading={isLoading}
                        onLink={() => linkAccount(provider.id)}
                        onUnlink={() => unlinkAccount(provider.id)}
                      />
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="glass-card overflow-hidden">
                <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Shield
                        size={16}
                        className="text-emerald-500"
                        aria-hidden="true"
                      />
                      {t("account.accessSummary", "host")}
                    </CardTitle>
                    <Badge
                      className={cn(
                        address
                          ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-600"
                          : "border-gray-200 bg-gray-100 text-gray-500",
                      )}
                    >
                      {address
                        ? t("account.ready", "host")
                        : t("account.connect", "host")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <AccountInfoRow
                    label={t("account.rowWallet", "host")}
                    value={walletStatus}
                  />
                  <AccountInfoRow
                    label={t("account.rowLinkedSocials", "host")}
                    value={String(connectedProviders)}
                  />
                  <AccountInfoRow
                    label={t("account.rowRatings", "host")}
                    value={t("account.rowRatingsValue", "host")}
                  />
                  <AccountInfoRow
                    label={t("account.rowPlatformStats", "host")}
                    value={t("account.rowPlatformStatsValue", "host")}
                  />
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Link2
                      size={16}
                      className="text-amber-500"
                      aria-hidden="true"
                    />
                    {t("account.nextActions", "host")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link
                    href="/miniapps"
                    className="block rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 transition-colors hover:border-neo/30 hover:bg-neo/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                  >
                    {t("account.browseMiniapps", "host")}
                  </Link>
                  <Link
                    href="/docs"
                    className="block rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 transition-colors hover:border-neo/30 hover:bg-neo/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                  >
                    {t("account.readDocs", "host")}
                  </Link>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <BookOpen
                      size={16}
                      className="text-indigo-400"
                      aria-hidden="true"
                    />
                    {t("account.policyTitle", "host")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs leading-relaxed text-gray-500">
                  <p>{t("account.policyBody1", "host")}</p>
                  <p>{t("account.policyBody2", "host")}</p>
                </CardContent>
              </Card>

              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Shield
                    size={16}
                    className="text-indigo-400"
                    aria-hidden="true"
                  />
                  {t("account.securityTipTitle", "host")}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  {t("account.securityTipBody", "host")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
