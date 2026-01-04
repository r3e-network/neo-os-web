import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Wallet, Trophy, Zap, TrendingUp, Flame, User, LogOut, Mail, Check, Github, Twitter, Chrome } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";
import { useGamification } from "@/hooks/useGamification";
import { BadgeGrid } from "@/components/features/gamification";
import { SecretManagement, TokenManagement, AccountBackup, PasswordChange } from "@/components/features/account";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function AccountPage() {
  const { t } = useTranslation("host");
  const { address, connected } = useWalletStore();
  const { user } = useUser();
  const { stats, levelInfo } = useGamification(address);

  // Fallback values
  const currentXP = stats?.xp || 0;
  const maxXP = levelInfo?.maxXP || 100;
  const progress = levelInfo?.progress || 0;
  const level = stats?.level || 1;
  const rank = stats?.rank || "-";

  return (
    <Layout>
      <Head>
        <title>{t("account.title")} - NeoHub</title>
      </Head>

      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10 text-center md:text-left">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">{t("account.title")}</h1>
          <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">{t("account.subtitle")}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Main Content Column */}
          <div className="lg:col-span-8 space-y-8">

            {/* Wallet Section */}
            <Card className="glass-card overflow-hidden">
              {/* ... (existing wallet content) ... */}
              <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl text-gray-900 dark:text-white flex items-center gap-2">
                      <Wallet className="text-emerald-500" size={24} />
                      {t("account.wallet.title")}
                    </CardTitle>
                    <CardDescription className="mt-1">{t("account.wallet.subtitle")}</CardDescription>
                  </div>
                  <Badge
                    variant={connected ? "default" : "secondary"}
                    className={cn(
                      "text-sm px-3 py-1",
                      connected
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    )}
                  >
                    {connected ? t("account.wallet.connected") : t("account.wallet.disconnected")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/50 dark:bg-black/20 border border-gray-200 dark:border-white/5 backdrop-blur-sm">
                  <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                    <Wallet size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500 mb-0.5">
                      {t("account.wallet.address")}
                    </p>
                    <p className="text-lg font-mono text-gray-900 dark:text-white truncate">
                      {address || "—"}
                    </p>
                  </div>
                  {address && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(address)}
                      className="text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                      {t("account.wallet.copy")}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Auth/Profile Section with Socials */}
            <Card className="glass-card">
              <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl text-gray-900 dark:text-white flex items-center gap-2">
                      <User className="text-blue-500" size={24} />
                      {t("account.auth.title")}
                    </CardTitle>
                    <CardDescription className="mt-1">{t("account.auth.subtitle")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Main Auth Status */}
                {user ? (
                  <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                    <div className="flex items-center gap-4">
                      {user.picture ? (
                        <img src={user.picture} alt="" className="w-12 h-12 rounded-full ring-2 ring-white dark:ring-white/10" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <User size={24} />
                        </div>
                      )}
                      <div>
                        <p className="text-base font-bold text-gray-900 dark:text-white">{user.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                      </div>
                    </div>
                    <a href="/api/auth/logout">
                      <Button variant="ghost" size="sm" className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10">
                        <LogOut size={16} />
                        {t("account.auth.logout")}
                      </Button>
                    </a>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-gray-50 dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/10 text-center">
                    <p className="text-slate-500 dark:text-slate-400 mb-4">{t("account.notConnected")}</p>
                    <a href="/api/auth/login">
                      <Button className="bg-blue-600 hover:bg-blue-500 text-white min-w-[200px]">
                        {t("account.auth.signIn")}
                      </Button>
                    </a>
                  </div>
                )}

                {/* Email Settings */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Mail size={16} />
                    {t("account.auth.email")}
                  </h3>
                  <div className="flex gap-3">
                    <Input
                      defaultValue={user?.email || ""}
                      placeholder="your@email.com"
                      className="bg-white dark:bg-black/20"
                      readOnly={!!user?.email} // Read-only if provided by Auth0
                    />
                    <Button variant="outline" disabled={!user}>
                      {t("account.auth.update")}
                    </Button>
                  </div>
                  {!user?.email_verified && user?.email && (
                    <p className="text-xs text-amber-500 flex items-center gap-1">
                      <Zap size={12} /> Email not verified. Check your inbox.
                    </p>
                  )}
                </div>

                {/* Social Connections */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    {t("account.auth.connectedAccounts")}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Google */}
                    <SocialButton
                      icon={<Chrome size={18} />}
                      label={t("account.auth.google")}
                      connected={user?.sub?.includes("google-oauth2")}
                    />
                    {/* GitHub */}
                    <SocialButton
                      icon={<Github size={18} />}
                      label={t("account.auth.github")}
                      connected={user?.sub?.includes("github")}
                    />
                    {/* Twitter */}
                    <SocialButton
                      icon={<Twitter size={18} />}
                      label={t("account.auth.twitter")}
                      connected={user?.sub?.includes("twitter")}
                    />
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Sub-components for Advanced Settings */}
            <div className="space-y-8">
              <SecretManagement walletAddress={address} />
              <TokenManagement walletAddress={address} />
            </div>

            {/* Security Zone */}
            <div className="grid gap-6 md:grid-cols-2">
              <PasswordChange walletAddress={address} />
              <AccountBackup walletAddress={address} />
            </div>
          </div>

          {/* Sidebar Stats Column - (Unchanged) */}
          {/* ... */}
          <div className="lg:col-span-4 space-y-6">

            {/* Reputation Card */}
            <Card className="glass-card overflow-hidden border-emerald-500/20 dark:border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <CardHeader className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-900/20 dark:to-teal-900/20 border-b border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Trophy size={18} className="text-emerald-500" />
                    {t("account.reputation.title")}
                  </CardTitle>
                  <Badge className="bg-emerald-500 text-white border-0">
                    {t("account.reputation.level")} {level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="text-center">
                  <div className="text-4xl font-black text-emerald-500 dark:text-emerald-400 tabular-nums tracking-tight">
                    {currentXP.toLocaleString()}
                  </div>
                  <div className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1">
                    {levelInfo?.name || "Neo Rookie"}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span>{t("account.reputation.progress")} {level + 1}</span>
                    <span>{currentXP} / {maxXP} XP</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full shadow-sm transition-all duration-1000 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-white/5">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t("account.reputation.rank")}</div>
                    <Link href="/leaderboard" className="text-lg font-bold text-gray-900 dark:text-white hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors flex items-center justify-center gap-1">
                      {rank === "-" ? "-" : `#${rank}`}
                      {rank !== "-" && rank <= 100 && <TrendingUp size={14} className="text-emerald-500" />}
                    </Link>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Streak</div>
                    <div className="text-lg font-bold text-amber-500 flex items-center justify-center gap-1">
                      <Flame size={18} fill="currentColor" className="text-amber-500" />
                      {stats?.streak || 0}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Stats */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Zap size={18} className="text-amber-400" />
                  {t("account.activity.title")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <StatItem label={t("account.activity.transactions")} value={stats?.totalTx || 0} />
                <StatItem label={t("account.activity.votesCast")} value={stats?.totalVotes || 0} />
                <StatItem label={t("account.activity.appsUsed")} value={stats?.appsUsed || 0} />
                <StatItem label={t("account.activity.xpEarned")} value={stats?.xp || 0} />
              </CardContent>
            </Card>

            {/* Badges */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Trophy size={18} className="text-purple-500" />
                  Badges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BadgeGrid earnedBadges={stats?.badges || []} />
              </CardContent>
            </Card>

            {/* Security Tip */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-500/20">
              <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2 mb-2">
                <Shield size={16} />
                {t("account.security.title")}
              </h3>
              <p className="text-sm text-indigo-600/80 dark:text-indigo-200/70 leading-relaxed">
                {t("account.security.tip")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-center transition-all hover:bg-slate-100 dark:hover:bg-white/10">
      <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</div>
      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

function SocialButton({ icon, label, connected }: { icon: React.ReactNode, label: string, connected?: boolean }) {
  const { t } = useTranslation("host");
  return (
    <Button
      variant="outline"
      className={cn(
        "w-full justify-between h-auto py-3 px-4 border-slate-200 dark:border-white/10",
        connected ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30" : "hover:bg-slate-50 dark:hover:bg-white/5"
      )}
      onClick={() => !connected && (window.location.href = `/api/auth/login?connection=${label.toLowerCase()}`)}
    >
      <div className="flex items-center gap-3">
        <div className={cn("text-slate-500 dark:text-slate-400", connected && "text-emerald-600 dark:text-emerald-400")}>
          {icon}
        </div>
        <span className={cn("text-sm font-medium", connected ? "text-emerald-700 dark:text-emerald-300" : "text-gray-700 dark:text-gray-300")}>
          {label}
        </span>
      </div>
      {connected ? (
        <Badge variant="outline" className="ml-2 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
          <Check size={10} className="mr-1" />
          {t("account.auth.connected")}
        </Badge>
      ) : (
        <span className="text-xs text-slate-400 group-hover:text-slate-500">{t("account.auth.connect")}</span>
      )}
    </Button>
  )
}
