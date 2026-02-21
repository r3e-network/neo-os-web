export function calculateLevel(xp: number): number {
  if (xp >= 2000) return 6;
  if (xp >= 1000) return 5;
  if (xp >= 600) return 4;
  if (xp >= 300) return 3;
  if (xp >= 100) return 2;
  return 1;
}

export function calculateXp(totalTx: number, appsUsed: number, totalVotes: number, streak: number): number {
  return Math.max(0, Math.floor(totalTx * 10 + appsUsed * 50 + totalVotes * 25 + streak * 15));
}

export function calculateStreak(isoDates: string[]): number {
  const days = Array.from(
    new Set(
      isoDates
        .map((date) => date.slice(0, 10))
        .filter(Boolean),
    ),
  ).sort((a, b) => b.localeCompare(a));

  if (days.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(`${days[i - 1]}T00:00:00.000Z`);
    const curr = new Date(`${days[i]}T00:00:00.000Z`);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
}

export function buildBadges(totalTx: number, appsUsed: number, totalVotes: number, streak: number): string[] {
  const badges: string[] = [];
  if (totalTx >= 1) badges.push("first_tx");
  if (appsUsed >= 5) badges.push("app_explorer");
  if (totalVotes >= 1) badges.push("governor");
  if (totalTx >= 100) badges.push("power_user");
  if (streak >= 7) badges.push("streak_7");
  if (streak >= 30) badges.push("streak_30");
  return badges;
}

