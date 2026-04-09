import { useEffect, useRef, useMemo } from "react";
import "./Fireworks.scss";

export interface FireworksProps {
  active?: boolean;
  duration?: number;
  onComplete?: () => void;
}

const FIREWORK_COLORS = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff6bd6", "#a855f7"];

export function Fireworks({ active = false, duration = 3000, onComplete }: FireworksProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (active) {
      timerRef.current = setTimeout(() => {
        onComplete?.();
      }, duration);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, duration, onComplete]);

  const fireworks = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const index = i + 1;
        const x = 10 + Math.random() * 80;
        const y = 10 + Math.random() * 60;
        const delay = Math.random() * 0.5;
        const color = FIREWORK_COLORS[i % FIREWORK_COLORS.length];

        return {
          index,
          style: {
            left: `${x}%`,
            top: `${y}%`,
            animationDelay: `${delay}s`,
            "--firework-color": color,
          } as React.CSSProperties,
        };
      }),
    // Regenerate positions each time active becomes true
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active],
  );

  if (!active) return null;

  return (
    <div className="fireworks-container" aria-hidden="true">
      {fireworks.map(({ index, style }) => (
        <div key={index} className={`firework firework-${index}`} style={style}>
          {Array.from({ length: 8 }, (_, j) => (
            <div key={j + 1} className={`spark spark-${j + 1}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Fireworks;
