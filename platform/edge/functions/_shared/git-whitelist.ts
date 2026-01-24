import { normalizeGitUrl } from "./build/git-manager.ts";

const INTERNAL_REPOS = ["https://github.com/r3e-network/miniapps"];

export function isInternalRepoUrl(gitUrl: string): boolean {
  const normalized = normalizeGitUrl(gitUrl).toLowerCase();
  return INTERNAL_REPOS.some((repo) => normalizeGitUrl(repo).toLowerCase() === normalized);
}
