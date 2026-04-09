import { useMemo } from "react";
import "./CheckinCalendar.scss";

interface CheckinCalendarProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  currentStreak: number;
  canCheckIn: boolean;
}

export default function CheckinCalendar({ t, currentStreak, canCheckIn }: CheckinCalendarProps) {
  const weekSlotFilled = useMemo(() => {
    const mod = currentStreak % 7;
    return currentStreak >= 7 && mod === 0 ? 7 : mod;
  }, [currentStreak]);

  const weekSlotToday = useMemo(() => {
    return weekSlotFilled === 7 && canCheckIn ? 1 : weekSlotFilled + 1;
  }, [weekSlotFilled, canCheckIn]);

  return (
    <div className="week-row-wrapper">
      <div className="week-progress-label">
        <span className="progress-text">{weekSlotFilled}/7 {t("dayPrefix")}s</span>
        {weekSlotFilled === 7 && <span className="week-complete-badge">COMPLETE</span>}
      </div>
      <div className="week-row">
        {Array.from({ length: 7 }, (_, i) => {
          const day = i + 1;
          const classes = [
            "week-day-slot",
            day <= weekSlotFilled ? "checked" : "",
            day === weekSlotToday ? "today" : "",
            !canCheckIn && day === weekSlotFilled ? "today-done" : "",
            canCheckIn && day === weekSlotToday ? "today-ready" : "",
          ].filter(Boolean).join(" ");

          return (
            <div key={day} className={classes}>
              <span
                className="day-icon"
                aria-label={day <= weekSlotFilled ? t("dayCompleted") : t("dayPending")}
              >
                {day <= weekSlotFilled ? "\u2714" : "\u25CB"}
              </span>
              <span className="day-label">{t("dayPrefix")}{day}</span>
              {day === 7 && weekSlotFilled >= 7 && (
                <span className="bonus-star" aria-hidden="true">&#x2B50;</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="week-connector">
        <div className="connector-fill" style={{ width: `${(weekSlotFilled / 7) * 100}%` }} />
      </div>
    </div>
  );
}
