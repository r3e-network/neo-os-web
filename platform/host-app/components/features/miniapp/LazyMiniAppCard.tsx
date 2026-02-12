"use client";

import { useEffect, useState, useRef } from "react";
import { MiniAppCard } from "./MiniAppCard";
import type { MiniAppInfo } from "./MiniAppCard";

interface LazyMiniAppCardProps {
  app: MiniAppInfo;
}

/**
 * Lazy-loaded MiniAppCard using IntersectionObserver
 * Only renders full card when visible in viewport
 */
export function LazyMiniAppCard({ app }: LazyMiniAppCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Once visible, stop observing
        }
      },
      { rootMargin: "200px", threshold: 0.1 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="min-h-[320px]">
      {isVisible ? <MiniAppCard app={app} /> : <CardPlaceholder name={app.name} />}
    </div>
  );
}

function CardPlaceholder({ name: _name }: { name: string }) {
  return (
    <div className="h-full rounded-xl bg-erobo-purple/10 dark:bg-erobo-bg-card animate-pulse">
      <div className="h-48 bg-erobo-purple/10 dark:bg-white/10 rounded-t-xl" />
      <div className="p-5">
        <div className="h-6 bg-erobo-purple/10 dark:bg-white/10 rounded w-3/4 mb-2" />
        <div className="h-4 bg-erobo-purple/10 dark:bg-white/10 rounded w-full" />
      </div>
    </div>
  );
}
