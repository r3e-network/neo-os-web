"use client";

import React, { useEffect, useState, useMemo } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { categoryParticles } from "./configs";

interface ParticleBannerProps {
  category: "gaming" | "defi" | "social" | "governance" | "utility" | "nft";
  appId: string;
  className?: string;
}

export function ParticleBanner({ category, appId, className = "" }: ParticleBannerProps) {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setInit(true));
  }, []);

  const options = useMemo(() => {
    return categoryParticles[category] || categoryParticles.gaming;
  }, [category]);

  if (!init) return null;

  return <Particles id={`particles-${appId}`} className={className} options={options} />;
}
