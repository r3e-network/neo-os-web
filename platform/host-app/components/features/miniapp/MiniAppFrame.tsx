import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_ASPECT_RATIO = 516 / 932;

type MiniAppFrameProps = {
  children: React.ReactNode;
  aspectRatio?: number;
  layout?: "web" | "mobile";
  className?: string;
};

export function MiniAppFrame({
  children,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  layout = "web",
  className,
}: MiniAppFrameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const ratio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : DEFAULT_ASPECT_RATIO;

  useEffect(() => {
    if (layout !== "mobile") return;
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;

      // Calculate dimensions that fit within container while maintaining aspect ratio
      // Height is the constraint - calculate width from height
      const widthFromHeight = height * ratio;

      // Use the smaller of: container width or calculated width from height
      const nextWidth = Math.min(width, widthFromHeight);
      const nextHeight = Math.min(height, nextWidth / ratio);

      const rounded = { width: Math.floor(nextWidth), height: Math.floor(nextHeight) };
      setFrameSize((prev) => (prev.width === rounded.width && prev.height === rounded.height ? prev : rounded));
    };

    updateSize();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateSize);
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateSize);
    const intervalId = window.setInterval(updateSize, 200);
    return () => {
      window.removeEventListener("resize", updateSize);
      window.clearInterval(intervalId);
    };
  }, [layout, ratio]);

  const frameStyle =
    layout === "mobile"
      ? frameSize.width && frameSize.height
        ? { width: frameSize.width, height: frameSize.height }
        : { width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", aspectRatio: ratio }
      : { width: "100%", height: "100%" };

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden", className)}
    >
      <div
        className={cn("relative overflow-hidden", layout === "mobile" ? "shrink-0" : "h-full w-full")}
        style={frameStyle}
      >
        {children}
      </div>
    </div>
  );
}
