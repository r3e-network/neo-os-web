// Git Manager for cloning and validating Git repositories
// Used for miniapp submission validation and building

/**
 * Clone a Git repository to a temporary directory
 * @param url - Git repository URL
 * @param branch - Branch to clone (default: main)
 * @param shallow - Whether to do a shallow clone (default: true)
 * @returns Path to cloned repository
 */
export async function cloneRepo(url: string, branch: string = "main", shallow: boolean = true): Promise<string> {
  const tempDir = Deno.makeTempDir({ prefix: "miniapp-clone-" });

  const args = ["clone", ...(shallow ? ["--depth", "1"] : []), "--single-branch", "--branch", branch, url, tempDir];

  const cloneProcess = new Deno.Command("git", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stderr } = await cloneProcess.output();

  if (code !== 0) {
    await cleanup(tempDir);
    throw new Error(`Git clone failed: ${stderr}`);
  }

  return tempDir;
}

/**
 * Get the current commit SHA of a repository
 * @param repoPath - Path to repository
 * @returns Commit SHA
 */
export async function getCommitSha(repoPath: string): Promise<string> {
  const process = new Deno.Command("git", {
    args: ["rev-parse", "HEAD"],
    cwd: repoPath,
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, code } = await process.output();

  if (code !== 0) {
    throw new Error(`Failed to get commit SHA`);
  }

  return stdout.trim();
}

/**
 * Get commit information
 * @param repoPath - Path to repository
 * @returns Commit info
 */
export async function getCommitInfo(repoPath: string): Promise<{
  sha: string;
  message: string;
  author: string;
  date: string;
}> {
  const format = '{"sha": "%H", "message": "%s", "author": "%an", "date": "%ci"}';

  const process = new Deno.Command("git", {
    args: ["log", "-1", `--format=${format}`],
    cwd: repoPath,
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, code } = await process.output();

  if (code !== 0) {
    throw new Error(`Failed to get commit info`);
  }

  return JSON.parse(stdout.trim());
}

/**
 * Get files changed between two commits
 * @param repoPath - Path to repository
 * @param oldSha - Old commit SHA
 * @param newSha - New commit SHA
 * @returns Array of changed files
 */
export async function getChangedFiles(repoPath: string, oldSha: string, newSha: string): Promise<string[]> {
  const process = new Deno.Command("git", {
    args: ["diff", "--name-only", `${oldSha}..${newSha}`],
    cwd: repoPath,
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout, code } = await process.output();

  if (code !== 0) {
    throw new Error(`Failed to get changed files`);
  }

  return stdout
    .trim()
    .split("\n")
    .filter((f) => f.length > 0);
}

/**
 * Check if a file exists in the repository
 * @param repoPath - Path to repository
 * @param filePath - Relative path to file
 * @returns True if file exists
 */
export async function fileExists(repoPath: string, filePath: string): Promise<boolean> {
  const fullPath = join(repoPath, filePath);

  try {
    const stat = await Deno.stat(fullPath);
    return stat.isFile;
  } catch {
    return false;
  }
}

/**
 * Read a file from the repository
 * @param repoPath - Path to repository
 * @param filePath - Relative path to file
 * @returns File content
 */
export async function readFile(repoPath: string, filePath: string): Promise<string> {
  const fullPath = join(repoPath, filePath);

  try {
    return await Deno.readTextFile(fullPath);
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

/**
 * Clean up temporary directory
 * @param dirPath - Path to directory to remove
 */
export async function cleanup(dirPath: string): Promise<void> {
  try {
    await Deno.remove(dirPath, { recursive: true });
  } catch (error) {
    console.warn(`Failed to cleanup ${dirPath}: ${error.message}`);
  }
}

/**
 * Normalize Git URL for consistent storage
 * @param url - Git URL to normalize
 * @returns Normalized URL
 */
export function normalizeGitUrl(url: string): string {
  // Remove .git suffix if present
  let normalized = url.replace(/\.git$/, "");

  // Remove trailing slash
  normalized = normalized.replace(/\/$/, "");

  // Convert to https if it's ssh
  normalized = normalized.replace(/^git@github\.com:/, "https://github.com/");

  return normalized;
}

/**
 * Extract repo owner and name from Git URL
 * @param url - Git URL
 * @returns { owner, name }
 */
export function parseGitUrl(url: string): { owner: string; name: string; host: string } {
  const normalized = normalizeGitUrl(url);
  const urlObj = new URL(normalized);

  const pathParts = urlObj.pathname.split("/").filter((p) => p.length > 0);

  return {
    host: urlObj.hostname,
    owner: pathParts[0] || "",
    name: pathParts[1]?.replace(/\.git$/, "") || "",
  };
}
