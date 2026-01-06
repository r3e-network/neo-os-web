"use client";

// App-specific SVG icons for each MiniApp
// Each app has a unique icon representing its functionality

// Gaming Icons
export function LotteryIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="10" r="2" fill="currentColor" />
      <circle cx="16" cy="10" r="2" fill="currentColor" />
      <circle cx="12" cy="15" r="2" fill="currentColor" />
      <path d="M7 7L17 17M17 7L7 17" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

export function CoinFlipIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="12" rx="8" ry="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6V18" stroke="currentColor" strokeWidth="2" />
      <path d="M9 9H15M9 15H15" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function DiceIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="16" cy="8" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="8" cy="16" r="1.5" fill="currentColor" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function ScratchCardIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M7 10H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 14H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="17" cy="14" r="2" fill="currentColor" />
    </svg>
  );
}

export function PokerIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="10" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M8 10L6 12L8 14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 10L18 8L16 14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function CrashIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 20L8 12L12 15L21 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 4H21V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21" cy="4" r="2" fill="currentColor" />
    </svg>
  );
}

// DeFi Icons
export function SwapIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 10L3 14L7 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 14H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 6L21 10L17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FlashLoanIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13 2L4 14H12L11 22L20 10H12L13 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.2"
      />
    </svg>
  );
}

export function StakingIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="14" width="4" height="6" rx="1" fill="currentColor" />
      <rect x="10" y="10" width="4" height="10" rx="1" fill="currentColor" />
      <rect x="16" y="6" width="4" height="14" rx="1" fill="currentColor" />
      <path d="M2 4L12 2L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function VaultIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <path d="M16 12H19" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// Social Icons
export function RedEnvelopeIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 13V17" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function HeartIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 21C12 21 3 13.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 13.5 14 21 14 21"
        stroke="currentColor"
        strokeWidth="2"
        fill="currentColor"
        fillOpacity="0.3"
      />
    </svg>
  );
}

export function TimeCapsuleIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="12" rx="6" ry="9" stroke="currentColor" strokeWidth="2" />
      <path d="M6 12H18" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

// NFT Icons
export function CanvasIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 16L10 12L14 14L18 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="7" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

export function TarotIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7L14 11H10L12 7Z" fill="currentColor" />
      <circle cx="12" cy="15" r="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// Governance Icons
export function VoteIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M4 10H20" stroke="currentColor" strokeWidth="2" />
      <path d="M9 14L11 16L15 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function GovernanceIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 7V9H21V7L12 2Z" stroke="currentColor" strokeWidth="2" />
      <path d="M5 9V17M9 9V17M15 9V17M19 9V17" stroke="currentColor" strokeWidth="2" />
      <path d="M3 17H21V20H3V17Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// Utility Icons
export function ExplorerIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ChartIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 14L11 10L15 13L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Default fallback icon
export function DefaultIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

// App ID to Icon mapping
const APP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // Gaming
  "miniapp-lottery": LotteryIcon,
  "miniapp-coinflip": CoinFlipIcon,
  "miniapp-dicegame": DiceIcon,
  "miniapp-scratchcard": ScratchCardIcon,
  "miniapp-secretpoker": PokerIcon,
  "miniapp-neo-crash": CrashIcon,
  "miniapp-fogchess": DiceIcon,
  "miniapp-fogpuzzle": DiceIcon,
  "miniapp-cryptoriddle": LotteryIcon,
  "miniapp-algobattle": CrashIcon,
  "miniapp-candlewars": CrashIcon,
  "miniapp-noloss-lottery": LotteryIcon,
  // DeFi
  "miniapp-neo-swap": SwapIcon,
  "miniapp-flashloan": FlashLoanIcon,
  "miniapp-neoburger": StakingIcon,
  "miniapp-gascircle": SwapIcon,
  "miniapp-compound-capsule": VaultIcon,
  "miniapp-self-loan": FlashLoanIcon,
  "miniapp-ilguard": VaultIcon,
  "miniapp-gridbot": ChartIcon,
  "miniapp-darkpool": VaultIcon,
  "miniapp-dutchauction": ChartIcon,
  "miniapp-quantumswap": SwapIcon,
  "miniapp-bridgeguardian": VaultIcon,
  "miniapp-neo-treasury": VaultIcon,
  // Social
  "miniapp-redenvelope": RedEnvelopeIcon,
  "miniapp-dev-tipping": HeartIcon,
  "miniapp-breakupcontract": HeartIcon,
  "miniapp-time-capsule": TimeCapsuleIcon,
  "miniapp-exfiles": VaultIcon,
  "miniapp-whisperchain": HeartIcon,
  "miniapp-aisoulmate": HeartIcon,
  "miniapp-darkradio": HeartIcon,
  // NFT
  "miniapp-canvas": CanvasIcon,
  "miniapp-onchaintarot": TarotIcon,
  "miniapp-garden-of-neo": CanvasIcon,
  "miniapp-graveyard": TarotIcon,
  "miniapp-nftchimera": CanvasIcon,
  "miniapp-nftevolve": CanvasIcon,
  "miniapp-schrodingernft": TarotIcon,
  "miniapp-zkbadge": CanvasIcon,
  // Governance
  "miniapp-candidate-vote": VoteIcon,
  "miniapp-govbooster": GovernanceIcon,
  "miniapp-gov-merc": GovernanceIcon,
  "miniapp-burn-league": GovernanceIcon,
  "miniapp-doomsday-clock": GovernanceIcon,
  "miniapp-masqueradedao": VoteIcon,
  "miniapp-council-governance": GovernanceIcon,
  // Utility
  "miniapp-explorer": ExplorerIcon,
  "miniapp-priceticker": ChartIcon,
  "miniapp-predictionmarket": ChartIcon,
  "miniapp-aitrader": ChartIcon,
  "miniapp-unbreakablevault": VaultIcon,
  "miniapp-heritage-trust": VaultIcon,
  "miniapp-guardianpolicy": VaultIcon,
  "miniapp-deadswitch": VaultIcon,
  "miniapp-geospotlight": ExplorerIcon,
  "miniapp-meltingasset": ChartIcon,
  "miniapp-paytoview": VaultIcon,
  "miniapp-worldpiano": CanvasIcon,
  "miniapp-screamtoearn": HeartIcon,
  "miniapp-parasite": CrashIcon,
  "miniapp-millionpiecemap": CanvasIcon,
  "miniapp-puzzlemining": DiceIcon,
  "miniapp-bountyhunter": ExplorerIcon,
};

export function getAppIcon(appId: string): React.ComponentType<{ className?: string }> {
  return APP_ICONS[appId] || DefaultIcon;
}
