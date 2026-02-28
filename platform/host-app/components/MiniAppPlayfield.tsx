import React, { useMemo } from "react";
import { FederatedMiniApp } from "./FederatedMiniApp";
import { parseFederatedEntryUrl } from "../lib/miniapp";
import { MiniAppInfo } from "./types";
import { resolveMiniAppDetailConfig } from "../lib/miniapp-template";
import { DetailContentBlocks } from "./features/miniapp/DetailContentBlocks";

// Deterministic color generation based on string hash
function stringToHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

const GRADIENTS = [
  "from-emerald-400 to-cyan-500",
  "from-violet-500 to-purple-500",
  "from-fuchsia-500 to-pink-500",
  "from-rose-400 to-red-500",
  "from-amber-400 to-orange-500",
  "from-blue-500 to-indigo-500",
  "from-cyan-400 to-blue-500",
  "from-teal-400 to-emerald-500",
  "from-yellow-400 to-amber-500",
  "from-indigo-400 to-cyan-400"
];

const ICONS = [
  "M13 10V3L4 14h7v7l9-11h-7z", // Lightning
  "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", // Coin
  "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z", // Puzzle
  "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z", // Potion
  "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", // Briefcase
  "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" // Play
];

export function MiniAppPlayfield({ app }: { app: MiniAppInfo }) {
  const isManifestMode = app.entry_url.startsWith("mf://manifest?");
  const federated = isManifestMode ? null : parseFederatedEntryUrl(app.entry_url, app.app_id);

  if (federated) {
    return (
      <div className="w-full h-[600px] rounded-2xl overflow-hidden bg-black relative border border-gray-200 dark:border-gray-800 shadow-sm">
        <FederatedMiniApp appId={federated.appId} view={federated.view} remote={federated.remote} />
      </div>
    );
  }

  // Manifest Runtime
  return <ManifestRuntime app={app} />;
}

function ManifestRuntime({ app }: { app: MiniAppInfo }) {
  const config = resolveMiniAppDetailConfig({
    frontend_spec: app.manifest?.frontend_spec,
    page_template: app.manifest?.page_template,
    detail_template: app.manifest?.detail_template,
    operation_panel: app.manifest?.operation_panel,
    operations: app.manifest?.operations,
    manifest: app.manifest,
  });

  const template = config.detailTemplate;
  const tabs = template?.tabs || [];
  const overviewTab = tabs.find((tab) => tab.type === "content") || tabs[0] || null;

  // Generate unique styling per miniapp
  const hash = Math.abs(stringToHash(app.app_id));
  const gradient = GRADIENTS[hash % GRADIENTS.length];
  const iconPath = ICONS[hash % ICONS.length];

  return (
    <div className={`w-full min-h-[400px] rounded-2xl overflow-hidden bg-gradient-to-br ${gradient} text-white relative shadow-2xl flex flex-col items-center justify-center p-8 text-center border-4 border-white/10 dark:border-black/20`}>
      <div className="absolute inset-0 bg-[url('/neo-pattern.svg')] opacity-20 mix-blend-overlay animate-pulse"></div>
      
      <div className="relative z-10 max-w-2xl w-full flex flex-col items-center">
        <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-2xl mb-6 shadow-xl border border-white/30 flex items-center justify-center transform rotate-3 hover:rotate-0 transition-transform duration-300">
          <svg className="w-10 h-10 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
          </svg>
        </div>

        <h2 className="text-4xl font-black mb-3 drop-shadow-lg tracking-tight">
          {app.name}
        </h2>
        
        <p className="text-white/90 text-lg mb-8 font-medium drop-shadow leading-relaxed max-w-lg">
          {app.description}
        </p>
        
        {overviewTab?.blocks?.length ? (
          <div className="bg-black/20 backdrop-blur-md rounded-2xl p-6 border border-white/10 text-left w-full shadow-inner">
            <DetailContentBlocks blocks={overviewTab.blocks} />
          </div>
        ) : (
          <div className="bg-black/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 text-sm font-semibold tracking-widest uppercase">
            Interact Using The Right Panel
          </div>
        )}
      </div>
    </div>
  );
}
