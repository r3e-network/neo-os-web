/**
 * @shared/neo — compatibility surface for miniapps that consume the runtime
 * translation function through a `useMessages()` hook (the naming some game
 * apps adopted). It reads the active app's `t()` from MiniAppContext, exactly
 * like `@shared/react`'s `useT`, so both conventions resolve to the same
 * locale-aware translator provided by MiniAppRoot.
 */

import { useT, type TFunction } from "../react";

export type { TFunction };

export function useMessages(): { t: TFunction } {
  return useT();
}
