"use client";

import React, { useState } from "react";
import { useTheme } from "../providers/ThemeProvider";
import { getThemeColors } from "../styles";

interface TwoPanelLayoutProps {
  header?: React.ReactNode;
  mainContent: React.ReactNode;
  sidePanel: React.ReactNode;
  sidePanelWidth?: number;
}

export function TwoPanelLayout({ header, mainContent, sidePanel, sidePanelWidth = 400 }: TwoPanelLayoutProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { theme } = useTheme();
  const colors = getThemeColors(theme);

  return (
    <>
      {/* Animated gradient keyframes (reused from SplitViewLayout) */}
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>

      {/* Desktop Layout — 2-panel */}
      <div
        className="hidden lg:flex flex-col h-screen"
        style={{
          backgroundImage:
            theme === "dark"
              ? "linear-gradient(-45deg, #0a0f1a, #0f1729, #0a1a1a, #0f0f1f, #0a0f1a)"
              : "linear-gradient(-45deg, #1e3a5f, #2d3a6d, #1a4a5a, #3d3a6d, #1e3a5f)",
          backgroundSize: "400% 400%",
          animation: "gradientShift 15s ease infinite",
        }}
      >
        {/* Header (in document flow, not fixed) */}
        {header && <div className="flex-shrink-0">{header}</div>}

        {/* Two-panel body */}
        <div className="flex flex-1 min-h-0 gap-3 p-3 pt-0">
          {/* Left — scrollable main content */}
          <main
            className="flex-1 min-w-0 overflow-y-auto rounded-xl shadow-lg"
            style={{ background: colors.bgSection }}
          >
            {mainContent}
          </main>

          {/* Right — independent scroll sidebar */}
          <aside
            className="overflow-y-auto rounded-xl shadow-lg flex-shrink-0"
            style={{
              width: sidePanelWidth,
              minWidth: sidePanelWidth,
              background: colors.bgSection,
            }}
          >
            {sidePanel}
          </aside>
        </div>
      </div>

      {/* Mobile Layout — single column + bottom drawer */}
      <div className="lg:hidden flex flex-col h-screen" style={{ background: colors.bg }}>
        {/* Header */}
        {header && <div className="flex-shrink-0">{header}</div>}

        {/* Main content fills viewport */}
        <main className="flex-1 min-h-0 overflow-y-auto">{mainContent}</main>

        {/* Bottom drawer toggle */}
        <div
          className="fixed bottom-0 left-0 right-0 h-12 flex items-center justify-center px-4 z-40"
          style={{
            background: colors.bgSection,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="flex items-center gap-2 transition-colors"
            style={{ color: colors.textMuted }}
          >
            <span className="text-sm">Operations</span>
            <svg
              className={`w-4 h-4 transition-transform ${isDrawerOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>

        {/* Mobile drawer overlay */}
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex flex-col">
            <div className="flex-1 bg-black/50" onClick={() => setIsDrawerOpen(false)} />
            <div className="h-[70vh] overflow-y-auto rounded-t-2xl" style={{ background: colors.bgSection }}>
              <div
                className="sticky top-0 p-4 flex justify-between items-center"
                style={{
                  background: colors.bgSection,
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <span className="font-semibold" style={{ color: colors.text }}>
                  Operations
                </span>
                <button onClick={() => setIsDrawerOpen(false)} style={{ color: colors.textMuted }}>
                  ✕
                </button>
              </div>
              {sidePanel}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
