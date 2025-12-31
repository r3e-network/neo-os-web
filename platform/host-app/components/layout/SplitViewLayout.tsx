"use client";

import React, { useState } from "react";

interface SplitViewLayoutProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  leftWidth?: number;
  mobileBreakpoint?: number;
}

export function SplitViewLayout({
  leftPanel,
  rightPanel,
  leftWidth = 420,
  mobileBreakpoint = 1024,
}: SplitViewLayoutProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:flex h-screen bg-[#050810]">
        {/* Left Panel - Fixed width */}
        <aside
          className="h-full overflow-y-auto border-r border-white/10 bg-[#0a0f1a]"
          style={{ width: leftWidth, minWidth: leftWidth }}
        >
          {leftPanel}
        </aside>

        {/* Right Panel - Flex grow */}
        <main className="flex-1 h-full overflow-hidden">{rightPanel}</main>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col h-screen bg-[#050810]">
        {/* Miniapp takes most of screen */}
        <main className="flex-1 overflow-hidden">{rightPanel}</main>

        {/* Bottom drawer toggle */}
        <button
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="fixed bottom-0 left-0 right-0 h-12 bg-[#0a0f1a] border-t border-white/10 flex items-center justify-center gap-2 text-white/70 z-40"
        >
          <span className="text-sm">App Details</span>
          <svg
            className={`w-4 h-4 transition-transform ${isDrawerOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>

        {/* Mobile drawer */}
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex flex-col">
            <div className="flex-1 bg-black/50" onClick={() => setIsDrawerOpen(false)} />
            <div className="h-[70vh] bg-[#0a0f1a] overflow-y-auto rounded-t-2xl">
              <div className="sticky top-0 bg-[#0a0f1a] p-4 border-b border-white/10 flex justify-between items-center">
                <span className="text-white font-semibold">App Details</span>
                <button onClick={() => setIsDrawerOpen(false)} className="text-white/50 hover:text-white">
                  ✕
                </button>
              </div>
              {leftPanel}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
