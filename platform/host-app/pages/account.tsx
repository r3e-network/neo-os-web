import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Wallet, Trophy, Zap, TrendingUp, Flame, User } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";
import { useGamification } from "@/hooks/useGamification";
import { BadgeGrid } from "@/components/features/gamification";
import { SecretManagement, TokenManagement, AccountBackup, PasswordChange } from "@/components/features/account";
import { useUser } from "@auth0/nextjs-auth0/client";

export default function AccountPage() {
  const { address, connected } = useWalletStore();
  const { user, isLoading: auth0Loading } = useUser();
  const { stats, levelInfo, loading: statsLoading } = useGamification(address);

  return (
    <Layout>
      <Head>
        <title>Account - NeoHub</title>
      </Head>

      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
          <p className="mt-2 text-slate-400">Manage your Neo identity and social connections</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Main Profile Info */}
          <div className="md:col-span-2 space-y-8">
            {/* Wallet Info */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="bg-neo/5 border-b border-white/5">
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
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-100 dark:bg-dark-800/50 border border-gray-200 dark:border-white/5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neo/20">
                    <Wallet className="text-neo" size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-400">Wallet Address</p>
                    <p className="text-lg font-mono text-gray-900 dark:text-white truncate">NdovA...s9Kda</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Auth0 Account */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Account</CardTitle>
                <CardDescription>Sign in with Google, Twitter, or GitHub</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {user ? (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-dark-900 border border-gray-200 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      {user.picture ? (
                        <img src={user.picture} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <User className="w-10 h-10 text-neo" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <a href="/api/auth/logout">
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        Logout
                      </Button>
                    </a>
                  </div>
                ) : (
                  <a href="/api/auth/login">
                    <Button className="w-full bg-neo hover:bg-neo/90">Sign in with Auth0</Button>
                  </a>
                )}
              </CardContent>
            </Card>

            {/* Developer Tools Section */}
            <SecretManagement walletAddress={address} />
            <TokenManagement walletAddress={address} />

            {/* Security Section */}
            <div className="grid gap-6 md:grid-cols-2">
              <PasswordChange walletAddress={address} />
              <AccountBackup walletAddress={address} />
            </div>
          </div>

          {/* Sidebar Stats */}
          <div className="space-y-6">
            {/* Reputation Card */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Trophy size={16} className="text-emerald-500" />
                    Reputation
                  </CardTitle>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Lv.{stats?.level || 1}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-emerald-500">{stats?.xp || 0}</div>
                  <div className="text-xs text-slate-400">{levelInfo?.name || "Newcomer"}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Progress to Lv.{(stats?.level || 1) + 1}</span>
                    <span className="text-slate-400">
                      {stats?.xp || 0}/{levelInfo?.maxXP || 100}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-200 dark:bg-dark-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                      style={{ width: `${levelInfo?.progress || 0}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <Link
                    href="/leaderboard"
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    <TrendingUp size={12} />
                    <span>Rank #{stats?.rank || "-"}</span>
                  </Link>
                  <div className="flex items-center gap-1 text-xs text-amber-400">
                    <Flame size={12} />
                    <span>{stats?.streak || 0} day streak</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Stats */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Zap size={16} className="text-amber-500" />
                  Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <StatItem label="Transactions" value={stats?.totalTx || 0} />
                <StatItem label="Votes Cast" value={stats?.totalVotes || 0} />
                <StatItem label="Apps Used" value={stats?.appsUsed || 0} />
                <StatItem label="XP Earned" value={stats?.xp || 0} />
              </CardContent>
            </Card>

            {/* Badges */}
            <Card className="glass-card">
              <CardContent className="pt-4">
                <BadgeGrid earnedBadges={stats?.badges || []} />
              </CardContent>
            </Card>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield size={14} className="text-indigo-400" />
                Security Tip
              </h3>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                Connect multiple socials to ensure you can always recover your account access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
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
    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-100 dark:bg-dark-900 border border-gray-200 dark:border-white/5">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{provider.icon}</span>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{provider.name}</p>
          {isConnected && account ? (
            <p className="text-xs text-slate-500">{account.email || account.name}</p>
          ) : (
            <p className="text-xs text-slate-500">Not connected</p>
          )}
        </div>
      </div>
      <Button
        variant={isConnected ? "outline" : "default"}
        size="sm"
        onClick={isConnected ? onUnlink : onLink}
        disabled={isLoading}
        className={cn(
          "h-8 text-xs",
          isConnected
            ? "border-white/10 text-slate-400 hover:text-red-400 hover:border-red-400/30"
            : "bg-neo hover:bg-neo/90",
        )}
      >
        {isLoading ? "..." : isConnected ? "Disconnect" : "Connect"}
      </Button>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-dark-800/50 text-center">
      <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </div>
  );
}

export const getServerSideProps = async () => ({ props: {} });
