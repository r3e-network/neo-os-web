import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Wallet, Link2, BookOpen } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";
import { useOAuthStore, oauthProviders } from "@/lib/oauth/store";
import { cn } from "@/lib/utils";

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

      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">Profile Settings</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Manage your Neo identity and social connections</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Main Profile Info */}
          <div className="md:col-span-2 space-y-8">
            {/* Wallet Info */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="bg-neo/5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-gray-900 dark:text-white">Neo Wallet</CardTitle>
                    <CardDescription>Your primary on-chain identity</CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-neo/10 text-neo border-neo/20">
                    Connected
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neo/20">
                    <Wallet className="text-neo" size={24} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Wallet Address</p>
                    <p className="text-lg font-mono text-gray-900 dark:text-white truncate">{shortAddress}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    disabled={!address}
                    onClick={() => address && navigator.clipboard.writeText(address)}
                  >
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Social Bindings */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Social Connections</CardTitle>
                <CardDescription>Bind your accounts for OAuth and extra rewards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {oauthProviders.map((provider) => {
                  const account = accounts.find((a) => a.provider === provider.id);
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

          {/* Sidebar Guidance */}
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
              <CardContent className="pt-4 space-y-4">
                <InfoRow label="Wallet" value={address ? "Connected" : "Not connected"} />
                <InfoRow label="Linked social accounts" value={String(connectedProviders)} />
                <InfoRow label="Ratings and comments" value="Available in each miniapp" />
                <InfoRow label="Platform statistics" value="Hidden from frontend" />
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
                <Link href="/miniapps" className="block rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800">
                  Browse live miniapps
                </Link>
                <Link href="/docs" className="block rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800">
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

            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield size={16} className="text-indigo-400" aria-hidden="true" />
                Security Tip
              </h3>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Connect multiple socials to ensure you can always recover your account access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-gray-100 px-3 py-2 dark:bg-gray-900">
      <span className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

function OAuthBindingItem({
  provider,
  account,
  isLoading,
  onLink,
  onUnlink,
}: {
  provider: { id: string; name: string; icon: string };
  account?: { email?: string; name?: string };
  isLoading: boolean;
  onLink: () => void;
  onUnlink: () => void;
}) {
  const isConnected = Boolean(account);

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{provider.icon}</span>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{provider.name}</p>
          {isConnected && account ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">{account.email || account.name}</p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">Not connected</p>
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
            ? "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:border-red-400/30 transition-colors"
            : "bg-neo hover:bg-neo/90",
        )}
      >
        {isLoading ? "..." : isConnected ? "Disconnect" : "Connect"}
      </Button>
    </div>
  );
}
