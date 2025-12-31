"use client";

import React, { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";

// Lazy load the actual particle component
const ParticleBanner = dynamic(() => import("./ParticleBanner").then((mod) => mod.ParticleBanner), {
  ssr: false,
  loading: () => null,
});

interface LazyParticleBannerProps {
  category: "gaming" | "defi" | "social" | "governance" | "utility" | "nft";
  appId: string;
  className?: string;
}

/**
 * Lazy-loaded ParticleBanner using IntersectionObserver
 * Only renders particles when the element is visible in viewport
 */
export function LazyParticleBanner({ category, appId, className = "" }: LazyParticleBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsVisible(visible);
        if (visible && !hasBeenVisible) {
          setHasBeenVisible(true);
        }
      },
      {
        rootMargin: "100px", // Start loading slightly before visible
        threshold: 0.1,
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasBeenVisible]);

  return (
    <div ref={containerRef} className={className}>
      {/* Only render particles if visible AND has been visible before */}
      {hasBeenVisible && isVisible && <ParticleBanner category={category} appId={appId} className={className} />}
    </div>
  );
}
