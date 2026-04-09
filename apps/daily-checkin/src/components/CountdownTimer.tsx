import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./CountdownTimer.scss";

const CIRCUMFERENCE = 2 * Math.PI * 99;

interface CountdownTimerProps {
  targetTime: number;
  label?: string;
  totalDuration?: number;
  showDays?: boolean;
  showHours?: boolean;
  textOnly?: boolean;
  ariaLabel?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  onComplete?: () => void;
  children?: (props: { remaining: number; display: string; progress: number; isComplete: boolean }) => React.ReactNode;
}

export default function CountdownTimer({
  targetTime,
  label,
  totalDuration = 0,
  showDays = true,
  showHours = true,
  textOnly = false,
  ariaLabel,
  t,
  onComplete,
  children,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const effectiveTotalDuration = totalDuration > 0 ? totalDuration : targetTime - startTimeRef.current;

  const progress = useMemo(() => {
    if (effectiveTotalDuration <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - remaining / effectiveTotalDuration));
  }, [remaining, effectiveTotalDuration]);

  const strokeOffset = CIRCUMFERENCE * (1 - progress);

  const urgencyLevel = useMemo(() => {
    const totalSec = Math.max(0, Math.ceil(remaining / 1000));
    const h = Math.floor(totalSec / 3600);
    if (h >= 1) return "calm";
    const m = Math.floor(totalSec / 60);
    if (m >= 5) return "attention";
    return "urgent";
  }, [remaining]);

  const urgencyColor = useMemo(() => {
    switch (urgencyLevel) {
      case "calm": return "#00e599";
      case "attention": return "#fbbf24";
      case "urgent": return "#ef4444";
      default: return "#00e599";
    }
  }, [urgencyLevel]);

  const display = useMemo(() => {
    const totalSec = Math.max(0, Math.ceil(remaining / 1000));
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");

    if (showDays && d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
    const totalH = d * 24 + h;
    if (showHours && totalH > 0) return `${pad(totalH)}:${pad(m)}:${pad(s)}`;
    if (totalH > 0) return `${pad(totalH)}:${pad(m)}:${pad(s)}`;
    return `${pad(m)}:${pad(s)}`;
  }, [remaining, showDays, showHours]);

  const tick = useCallback(() => {
    const r = Math.max(0, targetTime - Date.now());
    setRemaining(r);
    if (r <= 0 && !isComplete) {
      setIsComplete(true);
      onComplete?.();
    }
  }, [targetTime, isComplete, onComplete]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    setIsComplete(false);
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetTime, tick]);

  if (children) {
    return (
      <div className="countdown-timer" role="timer" aria-label={ariaLabel || t("countdownDefault")}>
        <div className="countdown-timer__custom">
          {children({ remaining, display, progress, isComplete })}
        </div>
      </div>
    );
  }

  if (textOnly) {
    return (
      <div className="countdown-timer" role="timer" aria-label={ariaLabel || t("countdownDefault")}>
        <div className="countdown-timer__text-only">
          <span className="countdown-timer__time">{display}</span>
          {label && <span className="countdown-timer__label">{label}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="countdown-timer" role="timer" aria-label={ariaLabel || t("countdownDefault")}>
      <div className={`countdown-timer__circle urgency-${urgencyLevel}`}>
        <svg className="countdown-timer__ring" viewBox="0 0 220 220" aria-hidden="true">
          <circle className="countdown-timer__ring-bg" cx="110" cy="110" r="99" />
          <circle
            className="countdown-timer__ring-progress"
            cx="110"
            cy="110"
            r="99"
            style={{ strokeDashoffset: strokeOffset, stroke: urgencyColor }}
          />
        </svg>
        <div className="countdown-timer__display">
          <span className="countdown-timer__time" style={{ textShadow: `0 0 20px ${urgencyColor}50` }}>{display}</span>
          {label && <span className="countdown-timer__label">{label}</span>}
          <span className={`countdown-timer__urgency-hint ${urgencyLevel}`}>
            {urgencyLevel === "calm" ? t("plentyOfTime") : urgencyLevel === "attention" ? t("hurryUp") : t("almostGone")}
          </span>
        </div>
      </div>
    </div>
  );
}
