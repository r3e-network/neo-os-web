import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ThemeItemChip } from "./ThemeItemChip";
import { TRAY_SLOTS, type ExtractReceipt } from "./logic/engine-zhuada";
import {
  advanceTrayMotion,
  createTrayMotionState,
  startTrayMotion,
  trayFromTokens,
  trayMotionPhaseDuration,
} from "./logic/tray-motion";
import type { GameThemeId } from "./logic/themes";

interface AnimatedTrayProps {
  tray: (number | null)[];
  receipt: ExtractReceipt | null;
  themeId: GameThemeId;
  label: string;
  emptyLabel: string;
  itemName(kind: number): string;
}

function signature(tray: (number | null)[]): string {
  return Array.from({ length: TRAY_SLOTS }, (_, index) => tray[index] ?? null).join(",");
}

/**
 * Presentation-only tray. Rules settle synchronously in the engine, while
 * this keyed token layer preserves the readable grouping/highlight/clear beats
 * and animates surviving items into their new left-compacted positions.
 */
export function AnimatedTray({
  tray,
  receipt,
  themeId,
  label,
  emptyLabel,
  itemName,
}: AnimatedTrayProps) {
  const generationRef = useRef(0);
  const pendingReceiptsRef = useRef<ExtractReceipt[]>([]);
  const reducedMotionRef = useRef(
    typeof window !== "undefined"
      && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false),
  );
  const [motion, setMotion] = useState(() => ({
    ...createTrayMotionState(tray),
    receiptNonce: receipt?.nonce ?? 0,
  }));
  const traySignature = signature(tray);
  const receiptNonce = receipt?.nonce ?? 0;

  useEffect(() => {
    setMotion((current) => {
      if (receipt?.accepted && receipt.nonce > current.receiptNonce) {
        if (reducedMotionRef.current) {
          pendingReceiptsRef.current = [];
          const settled = createTrayMotionState(receipt.settledTray, ++generationRef.current);
          return { ...settled, receiptNonce: receipt.nonce };
        }
        if (current.phase !== "idle") {
          if (!pendingReceiptsRef.current.some((pending) => pending.nonce === receipt.nonce)) {
            pendingReceiptsRef.current = [...pendingReceiptsRef.current, receipt]
              .sort((a, b) => a.nonce - b.nonce);
          }
          return current;
        }
        return startTrayMotion(current, receipt);
      }
      if (current.phase === "idle") {
        pendingReceiptsRef.current = pendingReceiptsRef.current
          .filter((pending) => pending.accepted && pending.nonce > current.receiptNonce);
        const nextReceipt = pendingReceiptsRef.current.shift();
        if (nextReceipt) return startTrayMotion(current, nextReceipt);
        if (signature(trayFromTokens(current.tokens)) !== traySignature) {
          return createTrayMotionState(tray, ++generationRef.current);
        }
      }
      return current;
    });
  }, [motion.phase, receipt, receiptNonce, tray, traySignature]);

  useEffect(() => {
    const delay = trayMotionPhaseDuration(motion.phase);
    if (delay === null) return;
    const timer = window.setTimeout(() => setMotion(advanceTrayMotion), delay);
    return () => window.clearTimeout(timer);
  }, [motion.phase]);

  const tokenAt = useMemo(() => new Map(motion.tokens.map((token) => [token.index, token])), [motion.tokens]);
  const matchVisible = motion.phase === "highlight" || motion.phase === "clearing";

  return (
    <div
      className="goose-tray"
      role="list"
      aria-label={label}
      data-motion-phase={motion.phase}
    >
      <div className="goose-tray__board">
        {Array.from({ length: TRAY_SLOTS }).map((_, index) => {
          const token = tokenAt.get(index);
          const name = token ? itemName(token.kind) : emptyLabel;
          return (
            <div
              key={index}
              className="goose-tray__slot"
              data-filled={token ? "true" : undefined}
              data-match={matchVisible && token?.matched ? "true" : undefined}
              title={name}
              role="listitem"
              aria-label={name}
            />
          );
        })}
        <div className="goose-tray__items" aria-hidden="true">
          {motion.tokens.map((token) => ({
            token,
            style: {
              "--goose-tray-x": `calc(${token.index * 100}% + ${token.index * 5}px)`,
            } as CSSProperties,
          })).map(({ token, style }) => (
            <div
              key={token.id}
              className="goose-tray__item"
              data-incoming={token.incoming ? "true" : undefined}
              data-matched={token.matched ? "true" : undefined}
              data-kind={token.kind}
              style={style}
            >
              <ThemeItemChip themeId={themeId} kind={token.kind} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
