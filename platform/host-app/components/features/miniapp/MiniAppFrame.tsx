import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_ASPECT_RATIO = 9 / 16;

type MiniAppFrameProps = {
  children: React.ReactNode;
  aspectRatio?: number;
  className?: string;
};

export function MiniAppFrame({ children, aspectRatio = DEFAULT_ASPECT_RATIO, className }: MiniAppFrameProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ratio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : DEFAULT_ASPECT_RATIO;

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      const nextHeight = Math.min(height, width / ratio);
      const nextWidth = nextHeight * ratio;
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
    return () => window.removeEventListener("resize", updateSize);
  }, [aspectRatio]);

  const frameStyle = frameSize.width && frameSize.height ? { width: frameSize.width, height: frameSize.height } : undefined;

  return (
    <div ref={containerRef} className={cn("flex h-full w-full items-center justify-center overflow-hidden", className)}>
      <div className="relative h-full w-full overflow-hidden" style={frameStyle}>
        {children}
      </div>
    </div>
  );
}
