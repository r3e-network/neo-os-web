import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";
import {
  Download,
  Chrome,
  Smartphone,
  Shield,
  Zap,
  CheckCircle2,
  ExternalLink,
  Apple,
  MonitorSmartphone,
} from "lucide-react";

interface WalletInfo {
  id: string;
  name: string;
  icon: string;
  platforms: string[];
  links: {
    chrome?: string;
    ios?: string;
    android?: string;
    website: string;
  };
  features: string[];
  recommended?: boolean;
}

const WALLETS: WalletInfo[] = [
  {
    id: "neoline",
    name: "NeoLine",
    icon: "/images/wallets/neoline.svg",
    platforms: ["chrome", "ios", "android"],
    links: {
      chrome: "https://chrome.google.com/webstore/detail/neoline/cphhlgmgameodnhkjdmkpanlelnlohao",
      ios: "https://apps.apple.com/app/neoline-wallet/id1606269116",
      android: "https://play.google.com/store/apps/details?id=com.neoline.wallet",
      website: "https://neoline.io",
    },
    features: ["dapp_browser", "nft_support", "multi_chain"],
    recommended: true,
  },
  {
    id: "o3",
    name: "O3 Wallet",
    icon: "/images/wallets/o3.svg",
    platforms: ["chrome", "ios", "android"],
    links: {
      chrome: "https://chrome.google.com/webstore/detail/o3-wallet/bnlhfpfpjfkjpjkjpjkjpjkjpjkjpjkj",
      ios: "https://apps.apple.com/app/o3-wallet/id1528451572",
      android: "https://play.google.com/store/apps/details?id=network.o3.o3wallet",
      website: "https://o3.network",
    },
    features: ["swap", "staking", "portfolio"],
  },
  {
    id: "onegate",
    name: "OneGate",
    icon: "/images/wallets/onegate.svg",
    platforms: ["chrome", "ios", "android"],
    links: {
      chrome: "https://chrome.google.com/webstore/detail/onegate/nnpnnpemnckcfdebeekibpiijlicmpom",
      ios: "https://apps.apple.com/app/onegate-wallet/id1583279806",
      android: "https://play.google.com/store/apps/details?id=com.onegate.wallet",
      website: "https://onegate.space",
    },
    features: ["multi_wallet", "hardware_support", "governance"],
  },
];



function WalletCard({ wallet, t }: { wallet: WalletInfo; t: (key: string) => string }) {
  return (
    <Card
      className={cn(
        "erobo-card relative overflow-hidden transition-all duration-300 hover:shadow-[0_30px_80px_rgba(159,157,243,0.2)] hover:-translate-y-1",
        wallet.recommended && "ring-2 ring-erobo-pink/50",
      )}
    >
      {wallet.recommended && (
        <div className="absolute top-4 right-4">
          <Badge className="bg-erobo-pink text-erobo-ink">{t("download.recommended")}</Badge>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-erobo-mint/70 to-erobo-sky/80 dark:from-erobo-mint/20 dark:to-erobo-sky/20 flex items-center justify-center p-3 shadow-inner">
            <img
              src={wallet.icon}
              alt={wallet.name}
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/logo-icon.png";
              }}
            />
          </div>
          <div>
            <CardTitle className="text-xl text-erobo-ink dark:text-white">{wallet.name}</CardTitle>
            <CardDescription className="mt-1">{t(`download.wallets.${wallet.id}.description`)}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Features */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-erobo-ink-soft/80 dark:text-slate-400">
            {t("download.features")}
          </p>
          <div className="flex flex-wrap gap-2">
            {wallet.features.map((feature) => (
              <span
                key={feature}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-erobo-peach/40 dark:bg-white/10 text-erobo-ink dark:text-gray-300"
              >
                <CheckCircle2 className="h-3 w-3 text-erobo-purple" />
                {t(`download.featureLabels.${feature}`)}
              </span>
            ))}
          </div>
        </div>

        {/* Download Buttons */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-erobo-ink-soft/80 dark:text-slate-400">
            {t("download.availableOn")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {wallet.links.chrome && (
              <a
                href={wallet.links.chrome}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full justify-start gap-2 border-erobo-purple/30 text-erobo-ink hover:bg-erobo-purple/10",
                )}
              >
                <Chrome className="h-4 w-4" />
                Chrome
                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
              </a>
            )}
            {wallet.links.ios && (
              <a
                href={wallet.links.ios}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full justify-start gap-2 border-erobo-purple/30 text-erobo-ink hover:bg-erobo-purple/10",
                )}
              >
                <Apple className="h-4 w-4" />
                iOS
                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
              </a>
            )}
            {wallet.links.android && (
              <a
                href={wallet.links.android}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full justify-start gap-2 border-erobo-purple/30 text-erobo-ink hover:bg-erobo-purple/10",
                )}
              >
                <Smartphone className="h-4 w-4" />
                Android
                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
              </a>
            )}
          </div>
        </div>

        {/* Website Link */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <a
            href={wallet.links.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-erobo-purple hover:underline inline-flex items-center gap-1"
          >
            {t("download.visitWebsite")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DownloadPage() {
  const { t } = useTranslation("host");

  return (
    <Layout>
      <Head>
        <title>{`${t("download.title")} - NeoHub`}</title>
        <meta name="description" content={t("download.subtitle")} />
      </Head>

      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <Badge className="mb-4 bg-erobo-peach/70 text-erobo-ink">
            <Download className="h-3 w-3 mr-1" />
            {t("download.badge")}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold text-erobo-ink dark:text-white tracking-tight">
            {t("download.title")}
          </h1>
          <p className="mt-4 text-lg text-erobo-ink-soft/80 dark:text-slate-400 max-w-2xl mx-auto">
            {t("download.subtitle")}
          </p>
        </div>

        {/* Why You Need a Wallet */}
        <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-4 p-6 rounded-xl erobo-card">
            <div className="h-10 w-10 rounded-lg bg-erobo-mint/60 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-erobo-ink" />
            </div>
            <div>
              <h3 className="font-semibold text-erobo-ink dark:text-white">{t("download.benefits.security.title")}</h3>
              <p className="mt-1 text-sm text-erobo-ink-soft/80 dark:text-slate-400">
                {t("download.benefits.security.description")}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-6 rounded-xl erobo-card">
            <div className="h-10 w-10 rounded-lg bg-erobo-purple/20 flex items-center justify-center flex-shrink-0">
              <Zap className="h-5 w-5 text-erobo-purple" />
            </div>
            <div>
              <h3 className="font-semibold text-erobo-ink dark:text-white">{t("download.benefits.instant.title")}</h3>
              <p className="mt-1 text-sm text-erobo-ink-soft/80 dark:text-slate-400">
                {t("download.benefits.instant.description")}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-6 rounded-xl erobo-card">
            <div className="h-10 w-10 rounded-lg bg-erobo-peach/50 flex items-center justify-center flex-shrink-0">
              <MonitorSmartphone className="h-5 w-5 text-erobo-ink" />
            </div>
            <div>
              <h3 className="font-semibold text-erobo-ink dark:text-white">
                {t("download.benefits.multiplatform.title")}
              </h3>
              <p className="mt-1 text-sm text-erobo-ink-soft/80 dark:text-slate-400">
                {t("download.benefits.multiplatform.description")}
              </p>
            </div>
          </div>
        </div>

        {/* Wallet Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {WALLETS.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} t={t} />
          ))}
        </div>

        {/* Help Section */}
        <div className="text-center p-8 rounded-2xl bg-gradient-to-br from-erobo-mint/40 to-erobo-peach/50 dark:from-erobo-mint/10 dark:to-erobo-peach/10 border border-white/60 dark:border-white/10">
          <h2 className="text-xl font-bold text-erobo-ink dark:text-white mb-2">{t("download.help.title")}</h2>
          <p className="text-erobo-ink-soft/80 dark:text-slate-400 mb-4">{t("download.help.description")}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/docs" className={cn(buttonVariants({ variant: "outline" }), "border-erobo-purple/30")}>
              {t("download.help.docs")}
            </Link>
            <a
              href="https://discord.gg/neo"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "ghost" }), "text-erobo-ink")}
            >
              {t("download.help.community")}
              <ExternalLink className="h-3 w-3 ml-2" />
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = async () => ({ props: {} });
