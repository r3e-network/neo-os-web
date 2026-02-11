import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WaterWaveBackground } from "@/components/ui/WaterWaveBackground";
import { Shield, Wallet, Trophy, Zap, TrendingUp, Flame, Copy } from "lucide-react";
import { useWalletStore } from "@/lib/wallet/store";
import { useGamification } from "@/hooks/useGamification";
import { BadgeGrid } from "@/components/features/gamification";
import { SecretManagement, TokenManagement, AccountBackup, PasswordChange } from "@/components/features/account";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";

import { ScrollReveal } from "@/components/ui/ScrollReveal";

export default function AccountPage() {
  const { t } = useTranslation("host");
  const { address, connected } = useWalletStore();
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

      <div className="min-h-screen bg-transparent relative">
        {/* E-Robo Water Wave Background */}
        <WaterWaveBackground intensity="medium" colorScheme="mixed" className="opacity-70" />

        <div className="relative mx-auto max-w-6xl px-4 py-12">
          <div className="mb-10 text-center md:text-left">
            <h1 className="text-4xl font-bold text-erobo-ink dark:text-white">{t("account.title")}</h1>
            <p className="mt-2 text-base text-erobo-ink-soft/70 dark:text-gray-400">{t("account.subtitle")}</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Main Content Column */}
            <div className="lg:col-span-8 space-y-8">
              {/* Wallet Section */}
              <ScrollReveal animation="fade-up" delay={0.1}>
                <Card className="erobo-card rounded-[28px] overflow-hidden">
                  <CardHeader className="border-b border-white/60 dark:border-white/10 pb-6 bg-erobo-purple/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-bold text-erobo-ink dark:text-white flex items-center gap-2">
                          <Wallet className="text-erobo-purple" size={24} strokeWidth={2} />
                          {t("account.wallet.title")}
                        </CardTitle>
                        <CardDescription className="mt-1 text-erobo-ink-soft/70 dark:text-gray-400">
                          {t("account.wallet.subtitle")}
                        </CardDescription>
                      </div>
                      <Badge
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium",
                          connected
                            ? "bg-erobo-mint/60 text-erobo-ink border border-white/60"
                            : "bg-white/70 dark:bg-white/5 text-erobo-ink-soft border border-white/60 dark:border-white/10",
                        )}
                      >
                        {connected ? t("account.wallet.connected") : t("account.wallet.disconnected")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10">
                      <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-xl bg-erobo-purple/10 text-erobo-purple">
                        <Wallet size={24} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-erobo-ink-soft/70 dark:text-gray-400 mb-0.5">
                          {t("account.wallet.address")}
                        </p>
                        <p className="text-base font-mono font-medium text-erobo-ink dark:text-white truncate">
                          {address || "—"}
                        </p>
                      </div>
                      {address && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(address)}
                          className="rounded-full border border-white/60 dark:border-white/10 hover:bg-erobo-purple/10 hover:text-erobo-purple hover:border-erobo-purple/30 transition-all"
                        >
                          <Copy size={16} />
                          <span className="sr-only">{t("account.wallet.copy")}</span>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>

              {/* Sub-components for Advanced Settings */}
              <div className="space-y-8">
                <ScrollReveal animation="fade-up" delay={0.5}>
                  <SecretManagement walletAddress={address} />
                </ScrollReveal>
                <ScrollReveal animation="fade-up" delay={0.6}>
                  <TokenManagement walletAddress={address} />
                </ScrollReveal>
              </div>

              {/* Security Zone */}
              <div className="grid gap-8 md:grid-cols-2">
                <ScrollReveal animation="slide-left" delay={0.7}>
                  <PasswordChange walletAddress={address} />
                </ScrollReveal>
                <ScrollReveal animation="slide-left" delay={0.8}>
                  <AccountBackup walletAddress={address} />
                </ScrollReveal>
              </div>
            </div>

            {/* Sidebar Stats Column */}
            <div className="lg:col-span-4 space-y-6">
              {/* Reputation Card */}
              <ScrollReveal animation="slide-left" delay={0.2} offset={-20}>
                <Card className="erobo-card rounded-[28px] overflow-hidden">
                  <CardHeader className="bg-erobo-purple/10 border-b border-white/60 dark:border-white/10 pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold text-erobo-ink dark:text-white flex items-center gap-2">
                        <Trophy size={18} className="text-erobo-purple" strokeWidth={2} />
                        {t("account.reputation.title")}
                      </CardTitle>
                      <Badge className="bg-erobo-mint/60 text-erobo-ink border border-white/60 rounded-full font-medium text-xs">
                        {t("account.reputation.level")} {level}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-erobo-ink dark:text-white tabular-nums">
                        {currentXP.toLocaleString()}
                      </div>
                      <div className="text-xs text-erobo-ink-soft/70 dark:text-gray-400 mt-2 bg-white/70 dark:bg-white/5 inline-block px-3 py-1 rounded-full">
                        {levelInfo?.name || "Neo Rookie"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-erobo-ink-soft/70 dark:text-gray-400">
                        <span>
                          {t("account.reputation.progress")} {level + 1}
                        </span>
                        <span>
                          {currentXP} / {maxXP} XP
                        </span>
                      </div>
                      <div className="h-2 w-full bg-white/70 dark:bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-erobo-purple rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/60 dark:border-white/10">
                      <div className="text-center p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10">
                        <div className="text-[10px] text-erobo-ink-soft/70 dark:text-gray-400 mb-1">
                          {t("account.reputation.rank")}
                        </div>
                        <Link
                          href="/leaderboard"
                          className="text-xl font-bold text-erobo-ink dark:text-white hover:text-erobo-purple transition-colors flex items-center justify-center gap-1"
                        >
                          {rank === "-" ? "-" : `#${rank}`}
                          {rank !== "-" && rank <= 100 && (
                            <TrendingUp size={14} className="text-erobo-purple" strokeWidth={2} />
                          )}
                        </Link>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10">
                        <div className="text-[10px] text-erobo-ink-soft/70 dark:text-gray-400 mb-1">Streak</div>
                        <div className="text-xl font-bold text-erobo-pink flex items-center justify-center gap-1">
                          <Flame size={18} fill="currentColor" strokeWidth={2} />
                          {stats?.streak || 0}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>

              {/* Activity Stats */}
              <ScrollReveal animation="slide-left" delay={0.3} offset={-20}>
                <Card className="erobo-card rounded-[28px]">
                  <CardHeader className="pb-4 border-b border-white/60 dark:border-white/10">
                    <CardTitle className="text-base font-bold text-erobo-ink dark:text-white flex items-center gap-2">
                      <Zap size={18} className="text-erobo-pink" strokeWidth={2} />
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
              </ScrollReveal>

              {/* Badges */}
              <ScrollReveal animation="slide-left" delay={0.4} offset={-20}>
                <Card className="erobo-card rounded-[28px]">
                  <CardHeader className="pb-4 border-b border-white/60 dark:border-white/10">
                    <CardTitle className="text-base font-bold text-erobo-ink dark:text-white flex items-center gap-2">
                      <Trophy size={18} className="text-erobo-purple" strokeWidth={2} />
                      Badges
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <BadgeGrid earnedBadges={stats?.badges || []} />
                  </CardContent>
                </Card>
              </ScrollReveal>

              {/* Security Tip */}
              <ScrollReveal animation="scale-in" delay={0.5}>
                <div className="p-5 rounded-2xl bg-gradient-to-br from-erobo-peach/40 to-erobo-purple/10 dark:from-erobo-purple/20 dark:to-erobo-purple-dark/20 border border-white/60 dark:border-erobo-purple/20">
                  <h3 className="text-sm font-medium text-erobo-ink dark:text-white flex items-center gap-2 mb-2">
                    <Shield size={16} className="text-erobo-purple" strokeWidth={2} />
                    {t("account.security.title")}
                  </h3>
                  <p className="text-xs text-erobo-ink-soft/70 dark:text-gray-400 leading-relaxed">
                    {t("account.security.tip")}
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 text-center hover:-translate-y-0.5 transition-all">
      <div className="text-xl font-bold text-erobo-ink dark:text-white tabular-nums">{value}</div>
      <div className="text-[10px] text-erobo-ink-soft/70 dark:text-gray-400 mt-1 leading-tight">{label}</div>
    </div>
  );
}
