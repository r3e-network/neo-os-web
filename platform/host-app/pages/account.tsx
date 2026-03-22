import Head from "next/head";
import Link from "next/link";
import { Layout, PageHero } from "@/components/layout";
import { AccountInfoRow, OAuthBindingItem } from "@/components/features/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Link2, Shield, Wallet } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";
import { oauthProviders, useOAuthStore } from "@/lib/oauth/store";

export default function AccountPage() {
  const { address } = useWalletStore();
  const { accounts, loading, linkAccount, unlinkAccount } = useOAuthStore();
  const connectedProviders = accounts.length;
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected";

  return (
    <Layout>
      <Head>
        <title>Account - R3E Network</title>
      </Head>

      <div className="pb-16 pt-20">
        <PageHero
          eyebrow="Identity"
          title="Profile Settings"
          description="Manage your Neo wallet identity, linked social accounts, and the current host-app frontend access policy in one place."
          stats={[
            { label: "Wallet", value: address ? "Connected" : "Not connected", hint: shortAddress },
            { label: "Linked socials", value: String(connectedProviders), hint: "OAuth providers available" },
          ]}
        />

        <div className="mx-auto max-w-4xl px-4 py-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="space-y-8 md:col-span-2">
              <Card className="glass-card overflow-hidden">
                <CardHeader className="border-b border-gray-200 bg-neo/5 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-gray-900 dark:text-white">Neo Wallet</CardTitle>
                      <CardDescription>Your primary on-chain identity</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-neo/20 bg-neo/10 text-neo">
                      Connected
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-100 p-4 dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neo/20">
                      <Wallet className="text-neo" size={24} aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Wallet Address</p>
                      <p className="truncate text-lg font-mono text-gray-900 dark:text-white">{shortAddress}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                      disabled={!address}
                      onClick={() => { if (address) { navigator.clipboard.writeText(address).catch((e: unknown) => { console.warn("[account] clipboard write failed:", e instanceof Error ? e.message : String(e)); }); } }}
                    >
                      Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Social Connections</CardTitle>
                  <CardDescription>Bind your accounts for OAuth and extra rewards</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {oauthProviders.map((provider) => {
                    const account = accounts.find((item) => item.provider === provider.id);
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
                <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                      <Shield size={16} className="text-emerald-500" aria-hidden="true" />
                      Access Summary
                    </CardTitle>
                    <Badge className="border-emerald-500/30 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      {address ? "Ready" : "Connect"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <AccountInfoRow label="Wallet" value={address ? "Connected" : "Not connected"} />
                  <AccountInfoRow label="Linked social accounts" value={String(connectedProviders)} />
                  <AccountInfoRow label="Ratings and comments" value="Available in each miniapp" />
                  <AccountInfoRow label="Platform statistics" value="Hidden from frontend" />
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <Link2 size={16} className="text-amber-500" aria-hidden="true" />
                    Next actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link
                    href="/miniapps"
                    className="block rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
                  >
                    Browse live miniapps
                  </Link>
                  <Link
                    href="/docs"
                    className="block rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
                  >
                    Read integration docs
                  </Link>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <BookOpen size={16} className="text-indigo-400" aria-hidden="true" />
                    Frontend policy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  <p>The account page now focuses on identity, wallet access, and connected providers.</p>
                  <p>Platform statistics remain hidden until the data pipeline is rebuilt. Reviews and comments stay enabled inside each miniapp.</p>
                </CardContent>
              </Card>

              <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6 dark:border-gray-700">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <Shield size={16} className="text-indigo-400" aria-hidden="true" />
                  Security Tip
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  Connect multiple socials to ensure you can always recover your account access.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
