/**
 * Utility MiniApp Animations
 */

"use client";

// Explorer - Magnify search
export function ExplorerAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-magnify-zoom">🔍</span>
        <div className="absolute inset-0 border-2 border-cyan-400/50 rounded-full animate-search-pulse" />
      </div>
    </div>
  );
}

// Guardian Policy - Policy shield
export function GuardianPolicyAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-shield-guard">🛡️</span>
        <span className="absolute -top-2 -right-2 text-2xl">📜</span>
      </div>
    </div>
  );
}

// Unbreakable Vault - Vault lock
export function UnbreakableVaultAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <div className="w-20 h-20 bg-gray-700 rounded-lg flex items-center justify-center animate-vault-secure">
          <span className="text-4xl">🔐</span>
        </div>
      </div>
    </div>
  );
}

// ZK Badge - Badge verify
export function ZKBadgeAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl animate-badge-stamp">🏅</span>
        <span className="absolute -bottom-2 -right-2 text-2xl animate-verify-check">✓</span>
      </div>
    </div>
  );
}

// Heritage Trust - Heritage tree
export function HeritageTrustAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl animate-tree-grow origin-bottom">🌳</span>
        <span className="absolute -top-4 text-2xl animate-float-slow">🏛️</span>
      </div>
    </div>
  );
}
