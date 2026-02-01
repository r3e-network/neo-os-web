"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, ShieldCheck, Zap, Lock } from "lucide-react";
import { MiniAppLogo } from "./MiniAppLogo";
import { WaterWaveBackground } from "../../ui/WaterWaveBackground";
import type { MiniAppInfo } from "../../types";

const LOADING_MESSAGES = [
  "WARMING UP VAULT",
  "VERIFYING SDK INTEGRITY",
  "SYNCING WALLET STATE",
  "ALIGNING NEON SIGNALS",
  "LAUNCH READY",
];

/**
 * MiniAppLoader - E-Robo water ripple launch styling
 * Displays an animated loading screen while MiniApp initializes
 */
export function MiniAppLoader({ app }: { app: MiniAppInfo }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((i) => (i < LOADING_MESSAGES.length - 1 ? i + 1 : i));
    }, 900);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#f5f6ff] to-[#e6fbf3] dark:from-[#05060d] dark:via-[#090a14] dark:to-[#050a0d]"
    >
      <WaterWaveBackground intensity="medium" colorScheme="mixed" className="opacity-80" />
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.5)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:24px_24px]" />

      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative z-10 flex flex-col items-center gap-6 px-10 py-10 rounded-[28px] bg-white/80 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 shadow-[0_20px_60px_rgba(70,60,120,0.15)] backdrop-blur-2xl"
      >
        <div className="relative flex items-center justify-center w-32 h-32">
          <span className="absolute inset-0 rounded-full border border-erobo-purple/30 animate-concentric-ripple" />
          <span className="absolute inset-0 rounded-full border border-erobo-purple/20 animate-concentric-ripple [animation-delay:0.35s]" />
          <span className="absolute inset-0 rounded-full border border-neo/20 animate-concentric-ripple [animation-delay:0.7s]" />
          <span className="absolute inset-0 rounded-full bg-erobo-purple/20 blur-md animate-[water-drop_1.6s_ease-out_infinite]" />
          <MiniAppLogo
            appId={app.app_id}
            category={app.category}
            size="lg"
            iconUrl={app.icon}
            className="relative z-10"
          />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">{app.name}</h2>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-white/60">MiniApp Launch</p>
        </div>

        <div className="w-56 h-2 rounded-full bg-gray-200/70 dark:bg-white/10 overflow-hidden">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 4, ease: "linear" }}
            className="h-full bg-gradient-to-r from-neo/80 via-erobo-purple/80 to-erobo-purple-dark/90"
          />
        </div>

        <div className="h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={msgIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-white/70"
            >
              {msgIndex === LOADING_MESSAGES.length - 1 ? (
                <Zap size={14} className="text-neo" strokeWidth={2.5} />
              ) : (
                <Loader2 size={14} className="animate-spin text-erobo-purple" strokeWidth={2.5} />
              )}
              <span>{LOADING_MESSAGES[msgIndex]}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-gray-400 dark:text-white/40">
          <span className="flex items-center gap-1">
            <ShieldCheck size={12} className="text-neo" />
            Secure Sandbox
          </span>
          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/20" />
          <span className="flex items-center gap-1">
            <Lock size={12} className="text-erobo-purple" />
            Isolated
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
