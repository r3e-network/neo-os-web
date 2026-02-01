import { normalizeGitUrl } from "./build/git-manager.ts";

const INTERNAL_REPOS = ["https://github.com/r3e-network/miniapps"];
const ALLOWED_HOSTS = ["github.com", "gitlab.com", "bitbucket.org"];

export function isInternalRepoUrl(gitUrl: string): boolean {
  const normalized = normalizeGitUrl(gitUrl).toLowerCase();
  return INTERNAL_REPOS.some((repo) => normalizeGitUrl(repo).toLowerCase() === normalized);
}

export function validateGitUrl(gitUrl: string): { valid: boolean; reason?: string } {
  try {
    const normalized = normalizeGitUrl(gitUrl);
    const url = new URL(normalized);

    if (url.protocol !== "https:") {
      return { valid: false, reason: "Only HTTPS git URLs are allowed" };
    }

    if (!ALLOWED_HOSTS.includes(url.hostname)) {
      return { valid: false, reason: "Git host is not allowed" };
    }

    const pathParts = url.pathname.split("/").filter((part) => part.length > 0);
    if (pathParts.length < 2) {
      return { valid: false, reason: "Git URL must include owner and repo" };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Invalid Git URL" };
  }
}
