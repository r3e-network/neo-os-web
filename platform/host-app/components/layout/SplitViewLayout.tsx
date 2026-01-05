"use client";

import React, { useState } from "react";
import { useTheme } from "../providers/ThemeProvider";
import { getThemeColors } from "../styles";

interface SplitViewLayoutProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel?: React.ReactNode;
  leftWidth?: number;
  rightWidth?: number;
  mobileBreakpoint?: number;
}

export function SplitViewLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  leftWidth = 380,
  rightWidth = 520,
  mobileBreakpoint = 1024,
}: SplitViewLayoutProps) {
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  return (
    <>
      {/* Animated gradient keyframes */}
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>

      {/* Desktop Layout - 3 columns with soft animated gradient */}
      <div
        className="hidden lg:flex h-screen items-stretch gap-3 p-3"
        style={{
          background:
            theme === "dark"
              ? `linear-gradient(-45deg, #0a0f1a, #0f1729, #0a1a1a, #0f0f1f, #0a0f1a)`
              : `linear-gradient(-45deg, #1e3a5f, #2d3a6d, #1a4a5a, #3d3a6d, #1e3a5f)`,
          backgroundSize: "400% 400%",
          animation: "gradientShift 15s ease infinite",
        }}
      >
        {/* Left Panel - Fixed width */}
        <aside
          className="h-full overflow-y-auto rounded-xl shadow-lg"
          style={{
            width: leftWidth,
            minWidth: leftWidth,
            background: colors.bgSection,
          }}
        >
          {leftPanel}
        </aside>

        {/* Center Panel - Flex grow (MiniApp) */}
        <main className="flex-1 h-full min-h-0 min-w-0 overflow-hidden rounded-xl shadow-lg">{centerPanel}</main>

        {/* Right Panel - Fixed width (optional) */}
        {rightPanel && (
          <aside
            className="h-full overflow-y-auto rounded-xl shadow-lg"
            style={{
              width: rightWidth,
              minWidth: rightWidth,
              background: colors.bgSection,
            }}
          >
            {rightPanel}
          </aside>
        )}
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col h-screen" style={{ background: colors.bg }}>
        {/* Miniapp takes most of screen */}
        <main className="flex-1 min-h-0 min-w-0 overflow-hidden">{centerPanel}</main>

        {/* Bottom drawer toggle buttons */}
        <div
          className="fixed bottom-0 left-0 right-0 h-12 flex items-center justify-between px-4 z-40"
          style={{ background: colors.bgSection, borderTop: `1px solid ${colors.border}` }}
        >
          <button
            onClick={() => setIsLeftDrawerOpen(!isLeftDrawerOpen)}
            className="flex items-center gap-2 transition-colors"
            style={{ color: colors.textMuted }}
          >
            <span className="text-sm">App Details</span>
            <svg
              className={`w-4 h-4 transition-transform ${isLeftDrawerOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          {rightPanel && (
            <button
              onClick={() => setIsRightDrawerOpen(!isRightDrawerOpen)}
              className="flex items-center gap-2 transition-colors"
              style={{ color: colors.textMuted }}
            >
              <span className="text-sm">Tech Info</span>
              <svg
                className={`w-4 h-4 transition-transform ${isRightDrawerOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Left Mobile drawer */}
        {isLeftDrawerOpen && (
          <div className="fixed inset-0 z-50 flex flex-col">
            <div className="flex-1 bg-black/50" onClick={() => setIsLeftDrawerOpen(false)} />
            <div className="h-[70vh] overflow-y-auto rounded-t-2xl" style={{ background: colors.bgSection }}>
              <div
                className="sticky top-0 p-4 flex justify-between items-center"
                style={{ background: colors.bgSection, borderBottom: `1px solid ${colors.border}` }}
              >
                <span className="font-semibold" style={{ color: colors.text }}>
                  App Details
                </span>
                <button onClick={() => setIsLeftDrawerOpen(false)} style={{ color: colors.textMuted }}>
                  ✕
                </button>
              </div>
              {leftPanel}
            </div>
          </div>
        )}

        {/* Right Mobile drawer */}
        {isRightDrawerOpen && rightPanel && (
          <div className="fixed inset-0 z-50 flex flex-col">
            <div className="flex-1 bg-black/50" onClick={() => setIsRightDrawerOpen(false)} />
            <div className="h-[70vh] overflow-y-auto rounded-t-2xl" style={{ background: colors.bgSection }}>
              <div
                className="sticky top-0 p-4 flex justify-between items-center"
                style={{ background: colors.bgSection, borderBottom: `1px solid ${colors.border}` }}
              >
                <span className="font-semibold" style={{ color: colors.text }}>
                  Technical Info
                </span>
                <button onClick={() => setIsRightDrawerOpen(false)} style={{ color: colors.textMuted }}>
                  ✕
                </button>
              </div>
              {rightPanel}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
