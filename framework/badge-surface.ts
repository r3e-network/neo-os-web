import type {
  FrameworkBadgeSurface,
  MiniAppFrameworkOS,
} from "./types";

export interface BadgeSurfaceDeps {
  osBadge: () => MiniAppFrameworkOS["badge"] | undefined;
}

export function createBadgeSurface(deps: BadgeSurfaceDeps): FrameworkBadgeSurface {
  const run = async (
    operation: (badge: NonNullable<MiniAppFrameworkOS["badge"]>) => Promise<void>,
  ): Promise<boolean> => {
    const badge = deps.osBadge();
    if (!badge) return false;
    await operation(badge);
    return true;
  };

  return {
    get available() {
      return Boolean(deps.osBadge());
    },
    define: (badgeId, name, criteria) =>
      run((badge) => badge.define(badgeId, name, criteria)),
    award: (badgeId, user) =>
      run((badge) => badge.award(badgeId, user)),
    revoke: async (badgeId, user) => {
      const badge = deps.osBadge();
      if (!badge?.revoke) return false;
      await badge.revoke(badgeId, user);
      return true;
    },
    async list(user) {
      const badge = deps.osBadge();
      return badge ? badge.list(user) : [];
    },
    updateStat: async (user, statKey, value) => {
      const badge = deps.osBadge();
      if (!badge?.updateStat) return false;
      await badge.updateStat(user, statKey, value);
      return true;
    },
    async getStat(user, statKey) {
      const badge = deps.osBadge();
      return badge?.getStat ? badge.getStat(user, statKey) : null;
    },
  };
}
