const RING_R = 52;
const ringCircumference = 2 * Math.PI * RING_R;

interface FundingHeroProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  progressPct: number;
  matchingPoolDisplay: string;
  projectCount: number;
}

export default function FundingHero({ t, progressPct, matchingPoolDisplay, projectCount }: FundingHeroProps) {
  const ringOffset = ringCircumference - (progressPct / 100) * ringCircumference;
  return (
    <div className="hero-container">
      <span className="hero-label">{t("appName")}</span>
      <div className="hero-progress-ring">
        <svg viewBox="0 0 120 120" className="ring-svg">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle cx="60" cy="60" r="52" fill="none" stroke="url(#qfRingGrad)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={ringCircumference} strokeDashoffset={ringOffset} transform="rotate(-90 60 60)" className="ring-progress" />
          <defs><linearGradient id="qfRingGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--qf-ring-start, #f472b6)" /><stop offset="100%" stopColor="var(--qf-ring-end, #ec4899)" /></linearGradient></defs>
        </svg>
        <div className="ring-center"><span className="ring-value">{progressPct}%</span><span className="ring-sub">{t("tabRounds")}</span></div>
      </div>
      <div className="hero-stats-row">
        <div className="hero-stat"><span className="hero-stat-label">{t("sidebarMatchingPool")}</span><span className="hero-stat-value">{matchingPoolDisplay}</span></div>
        <div className="hero-stat-divider" />
        <div className="hero-stat"><span className="hero-stat-label">{t("tabProjects")}</span><span className="hero-stat-value">{projectCount}</span></div>
      </div>
    </div>
  );
}
