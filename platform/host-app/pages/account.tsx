import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Wallet,
  Trophy,
  Zap,
  TrendingUp,
  Flame,
  User,
  LogOut,
  Mail,
  Check,
  Github,
  Twitter,
  Chrome,
  Copy,
} from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";
import { useGamification } from "@/hooks/useGamification";
import { BadgeGrid } from "@/components/features/gamification";
import {
  SecretManagement,
  TokenManagement,
  AccountBackup,
  PasswordChange,
  NeoAccountManagement,
  NeoHubAccountPanel,
} from "@/components/features/account";
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

      <div className="min-h-screen bg-gray-50 dark:bg-[#050505] relative">
        {/* E-Robo Water Wave Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] animate-water-wave opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(159,157,243,0.08)_0%,transparent_70%)]" />
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-12">
          <div className="mb-10 text-center md:text-left">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">{t("account.title")}</h1>
            <p className="mt-2 text-base text-gray-500 dark:text-gray-400">{t("account.subtitle")}</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Main Content Column */}
            <div className="lg:col-span-8 space-y-8">
              {/* Wallet Section */}
              <Card className="erobo-card bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-gray-200 dark:border-erobo-purple/20 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-gray-200 dark:border-white/10 pb-6 bg-neo/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Wallet className="text-neo" size={24} strokeWidth={2} />
                        {t("account.wallet.title")}
                      </CardTitle>
                      <CardDescription className="mt-1 text-gray-500 dark:text-gray-400">
                        {t("account.wallet.subtitle")}
                      </CardDescription>
                    </div>
                    <Badge
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        connected
                          ? "bg-neo/10 text-neo border border-neo/20"
                          : "bg-gray-100 dark:bg-white/5 text-gray-500 border border-gray-200 dark:border-white/10",
                      )}
                    >
                      {connected ? t("account.wallet.connected") : t("account.wallet.disconnected")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-xl bg-neo/10 text-neo">
                      <Wallet size={24} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                        {t("account.wallet.address")}
                      </p>
                      <p className="text-base font-mono font-medium text-gray-900 dark:text-white truncate">
                        {address || "—"}
                      </p>
                    </div>
                    {address && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(address)}
                        className="rounded-lg border border-gray-200 dark:border-white/10 hover:bg-neo/10 hover:text-neo hover:border-neo/20 transition-all"
                      >
                        <Copy size={16} />
                        <span className="sr-only">{t("account.wallet.copy")}</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* NeoHub Account Panel - for social account users */}
              {user && <NeoHubAccountPanel />}

              {/* Auth/Profile Section with Socials */}
              <Card className="erobo-card bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-gray-200 dark:border-erobo-purple/20 shadow-lg rounded-2xl">
                <CardHeader className="border-b border-gray-200 dark:border-white/10 pb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <User className="text-blue-500" size={24} strokeWidth={2} />
                        {t("account.auth.title")}
                      </CardTitle>
                      <CardDescription className="mt-1 text-gray-500 dark:text-gray-400">
                        {t("account.auth.subtitle")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Main Auth Status */}
                  {user ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                      <div className="flex items-center gap-4">
                        {user.picture ? (
                          <img
                            src={user.picture}
                            alt=""
                            className="w-12 h-12 rounded-xl border border-gray-200 dark:border-white/10"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-500">
                            <User size={24} strokeWidth={2} />
                          </div>
                        )}
                        <div>
                          <p className="text-base font-semibold text-gray-900 dark:text-white">{user.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{user.email}</p>
                        </div>
                      </div>
                      <a href="/api/auth/logout" className="w-full sm:w-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full sm:w-auto gap-2 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-medium hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
                        >
                          <LogOut size={16} strokeWidth={2} />
                          {t("account.auth.logout")}
                        </Button>
                      </a>
                    </div>
                  ) : (
                    <div className="p-8 rounded-xl bg-gray-50 dark:bg-white/5 border border-dashed border-gray-300 dark:border-white/10 text-center">
                      <p className="text-gray-500 dark:text-gray-400 mb-4">{t("account.notConnected")}</p>
                      <a href="/api/auth/login">
                        <Button className="rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all font-medium min-w-[200px]">
                          {t("account.auth.signIn")}
                        </Button>
                      </a>
                    </div>
                  )}

                  {/* Email Settings */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Mail size={16} strokeWidth={2} />
                      {t("account.auth.email")}
                    </h3>
                    <div className="flex gap-3">
                      <Input
                        defaultValue={user?.email || ""}
                        placeholder="your@email.com"
                        className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 font-mono"
                        readOnly={!!user?.email}
                      />
                      <Button
                        variant="outline"
                        disabled={!user}
                        className="rounded-lg border border-gray-200 dark:border-white/10 font-medium hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        {t("account.auth.update")}
                      </Button>
                    </div>
                    {!user?.email_verified && user?.email && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Zap size={14} fill="currentColor" /> Email not verified. Check your inbox.
                      </p>
                    )}
                  </div>

                  {/* Social Connections */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      {t("account.auth.connectedAccounts")}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Google */}
                      <SocialButton
                        icon={<Chrome size={20} strokeWidth={2.5} />}
                        label={t("account.auth.google")}
                        connected={user?.sub?.includes("google-oauth2")}
                      />
                      {/* GitHub */}
                      <SocialButton
                        icon={<Github size={20} strokeWidth={2.5} />}
                        label={t("account.auth.github")}
                        connected={user?.sub?.includes("github")}
                      />
                      {/* Twitter */}
                      <SocialButton
                        icon={<Twitter size={20} strokeWidth={2.5} />}
                        label={t("account.auth.twitter")}
                        connected={user?.sub?.includes("twitter")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Neo Account Management for Social Users */}
              {user && <NeoAccountManagement walletAddress={address} />}

              {/* Sub-components for Advanced Settings */}
              <div className="space-y-8">
                <SecretManagement walletAddress={address} />
                <TokenManagement walletAddress={address} />
              </div>

              {/* Security Zone */}
              <div className="grid gap-8 md:grid-cols-2">
                <PasswordChange walletAddress={address} />
                <AccountBackup walletAddress={address} />
              </div>
            </div>

            {/* Sidebar Stats Column */}
            <div className="lg:col-span-4 space-y-6">
              {/* Reputation Card */}
              <Card className="erobo-card bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-gray-200 dark:border-erobo-purple/20 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="bg-neo/10 border-b border-gray-200 dark:border-white/10 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Trophy size={18} className="text-neo" strokeWidth={2} />
                      {t("account.reputation.title")}
                    </CardTitle>
                    <Badge className="bg-neo/10 text-neo border border-neo/20 rounded-full font-medium text-xs">
                      {t("account.reputation.level")} {level}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums">
                      {currentXP.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 bg-gray-100 dark:bg-white/5 inline-block px-3 py-1 rounded-full">
                      {levelInfo?.name || "Neo Rookie"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        {t("account.reputation.progress")} {level + 1}
                      </span>
                      <span>
                        {currentXP} / {maxXP} XP
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neo rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-200 dark:border-white/10">
                    <div className="text-center p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                        {t("account.reputation.rank")}
                      </div>
                      <Link
                        href="/leaderboard"
                        className="text-xl font-bold text-gray-900 dark:text-white hover:text-neo transition-colors flex items-center justify-center gap-1"
                      >
                        {rank === "-" ? "-" : `#${rank}`}
                        {rank !== "-" && rank <= 100 && <TrendingUp size={14} className="text-neo" strokeWidth={2} />}
                      </Link>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Streak</div>
                      <div className="text-xl font-bold text-amber-500 flex items-center justify-center gap-1">
                        <Flame size={18} fill="currentColor" strokeWidth={2} />
                        {stats?.streak || 0}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Stats */}
              <Card className="erobo-card bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-gray-200 dark:border-erobo-purple/20 shadow-lg rounded-2xl">
                <CardHeader className="pb-4 border-b border-gray-200 dark:border-white/10">
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Zap size={18} className="text-amber-500" strokeWidth={2} />
                    {t("account.activity.title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 pt-4">
                  <StatItem label={t("account.activity.transactions")} value={stats?.totalTx || 0} />
                  <StatItem label={t("account.activity.votesCast")} value={stats?.totalVotes || 0} />
                  <StatItem label={t("account.activity.appsUsed")} value={stats?.appsUsed || 0} />
                  <StatItem label={t("account.activity.xpEarned")} value={stats?.xp || 0} />
                </CardContent>
              </Card>

              {/* Badges */}
              <Card className="erobo-card bg-white dark:bg-[#080808]/80 backdrop-blur-xl border border-gray-200 dark:border-erobo-purple/20 shadow-lg rounded-2xl">
                <CardHeader className="pb-4 border-b border-gray-200 dark:border-white/10">
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Trophy size={18} className="text-purple-500" strokeWidth={2} />
                    Badges
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <BadgeGrid earnedBadges={stats?.badges || []} />
                </CardContent>
              </Card>

              {/* Security Tip */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-erobo-purple/10 to-erobo-purple-dark/10 dark:from-erobo-purple/20 dark:to-erobo-purple-dark/20 border border-erobo-purple/20">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                  <Shield size={16} className="text-purple-500" strokeWidth={2} />
                  {t("account.security.title")}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{t("account.security.tip")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-center hover:-translate-y-0.5 transition-all">
      <div className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">{label}</div>
    </div>
  );
}

function SocialButton({ icon, label, connected }: { icon: React.ReactNode; label: string; connected?: boolean }) {
  const { t } = useTranslation("host");
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-between h-auto py-3 px-4 rounded-xl border transition-all",
        connected
          ? "bg-neo/10 text-neo border-neo/20"
          : "bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10",
      )}
      onClick={() => !connected && (window.location.href = `/api/auth/login?connection=${label.toLowerCase()}`)}
    >
      <div className="flex items-center gap-3">
        <div className={cn(connected ? "text-neo" : "text-gray-500 dark:text-gray-400")}>{icon}</div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      {connected ? (
        <Badge className="ml-2 bg-neo/10 text-neo border border-neo/20 rounded-full text-[10px] font-medium">
          <Check size={10} className="mr-1" />
          {t("account.auth.connected")}
        </Badge>
      ) : (
        <span className="text-xs text-gray-400 dark:text-gray-500">{t("account.auth.connect")}</span>
      )}
    </Button>
  );
}
