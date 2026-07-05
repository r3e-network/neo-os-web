/**
 * useT — read the active miniapp's translation function from context.
 *
 * The MiniAppRoot provides a fully-configured `t()` (merged base + app messages,
 * locale-aware) through MiniAppContext. Components that render *inside* a
 * PlayArea can call `useT()` to get that same `t` without threading it through
 * props. Outside a provider it degrades to an identity function so a component
 * still renders (returning the raw key) instead of throwing.
 */

import { useContext } from "react";
import { MiniAppContext } from "../context";

export type TFunction = (
  key: string,
  params?: Record<string, string | number>,
) => string;

const identityT: TFunction = (key) => key;

export function useT(): { t: TFunction } {
  const ctx = useContext(MiniAppContext);
  return { t: ctx?.t ?? identityT };
}
