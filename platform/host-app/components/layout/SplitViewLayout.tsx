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
  leftWidth = 420,
  rightWidth = 320,
  mobileBreakpoint = 1024,
}: SplitViewLayoutProps) {
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  return (
    <>
      {/* Desktop Layout - 3 columns */}
      <div className="hidden lg:flex h-screen" style={{ background: colors.bg }}>
        {/* Left Panel - Fixed width */}
        <aside
          className="h-full overflow-y-auto"
          style={{
            width: leftWidth,
            minWidth: leftWidth,
            background: colors.bgSection,
            borderRight: `1px solid ${colors.border}`,
          }}
        >
          {leftPanel}
        </aside>

        {/* Center Panel - Flex grow (MiniApp) */}
        <main className="flex-1 h-full overflow-hidden">{centerPanel}</main>

        {/* Right Panel - Fixed width (optional) */}
        {rightPanel && (
          <aside
            className="h-full overflow-y-auto"
            style={{
              width: rightWidth,
              minWidth: rightWidth,
              background: colors.bgSection,
              borderLeft: `1px solid ${colors.border}`,
            }}
          >
            {rightPanel}
          </aside>
        )}
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col h-screen" style={{ background: colors.bg }}>
        {/* Miniapp takes most of screen */}
        <main className="flex-1 overflow-hidden">{centerPanel}</main>

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
