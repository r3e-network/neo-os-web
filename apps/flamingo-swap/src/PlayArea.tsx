/**
 * PlayArea.tsx -- Flamingo Swap
 *
 * Placeholder component for the Flamingo Swap product.
 */

import type { Observable } from "@shared/react/context";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t }: PlayAreaProps) {
  return (
    <div className="flamingo-launcher-placeholder">
      <h2>Flamingo Swap</h2>
      <p>Product launcher will be wired when FlamingoLauncherPage is converted to React.</p>
    </div>
  );
}
