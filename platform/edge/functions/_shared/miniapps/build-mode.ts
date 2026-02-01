export function canTriggerBuild(mode?: string | null): boolean {
  return String(mode ?? "manual").toLowerCase() === "platform";
}
