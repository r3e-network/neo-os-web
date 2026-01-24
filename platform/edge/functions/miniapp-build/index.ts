// MiniApp Build Endpoint
// Manually triggered by admin after approving a submission

import "../_shared/init.ts";

declare const Deno: {
  serve(handler: (req: Request) => Promise<Response>): void;
  Command: new (
    cmd: string,
    options?: {
      args?: string[];
      cwd?: string;
      env?: Record<string, string>;
      stdout?: "piped" | "inherit" | "null";
      stderr?: "piped" | "inherit" | "null";
      stdin?: "piped" | "inherit" | "null";
    }
  ) => {
    output(): Promise<{ code: number; stdout: Uint8Array; stderr: Uint8Array }>;
  };
  readDirSync(path: string): Iterable<{ name: string; isDirectory: boolean; isSymlink: boolean }>;
  readFile(path: string): Promise<Uint8Array>;
  stat(path: string): Promise<{ size: number }>;
  makeTempDir(options?: { prefix?: string }): string;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { requireAuth } from "../_shared/supabase.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { cloneRepo, getCommitInfo, cleanup, normalizeGitUrl } from "../_shared/build/git-manager.ts";
import { validateGitUrl } from "../_shared/git-whitelist.ts";
import { detectAssets } from "../_shared/build/asset-detector.ts";
import { detectBuildConfig, readPackageScripts } from "../_shared/build/build-detector.ts";
import { uploadDirectory, uploadFile } from "../_shared/build/cdn-uploader.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface BuildRequest {
  submission_id: string;
}

interface BuildResponse {
  success: boolean;
  build_id: string;
  status: string;
  cdn_url?: string;
  error?: string;
}

// Maximum allowed build size to prevent DoS attacks (50MB)
const MAX_BUILD_SIZE = 50 * 1024 * 1024;

// Calculate directory size recursively
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const entries = Array.from(Deno.readDirSync(dirPath));

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;

      if (entry.isDirectory) {
        totalSize += await getDirectorySize(fullPath);
      } else if (entry.isSymlink) {
        // Skip symlinks to avoid double-counting or circular references
        continue;
      } else {
        try {
          const stat = await Deno.stat(fullPath);
          totalSize += stat.size;
        } catch {
          // File might have been deleted or inaccessible
          continue;
        }
      }
    }
  } catch (error) {
    console.warn(`Error calculating directory size for ${dirPath}:`, error);
  }

  return totalSize;
}

// CDN upload function - uploads build output to configured CDN provider
async function uploadToCDN(buildPath: string, appId: string, version: string): Promise<string> {
    // SECURITY: Validate build size before uploading to prevent DoS (50MB limit for custom miniapps)
  const buildSize = await getDirectorySize(buildPath);
  if (buildSize > MAX_BUILD_SIZE) {
    throw new Error(
      `Build size ${Math.round(buildSize / 1024 / 1024)}MB exceeds maximum 50MB limit`
    );
  }

  console.log(`Build size: ${Math.round(buildSize / 1024 / 1024)}MB`);

  const cdnBaseUrl = mustGetEnv("CDN_BASE_URL");
  const cdnKey = `miniapps/${appId}/${version}`;

  // Upload entire build directory recursively
  const result = await uploadDirectory(buildPath, cdnKey);

  if (result.failed > 0) {
    console.warn(`Upload completed with ${result.failed} failures`);
  }

  console.log(`Uploaded ${result.uploaded} files to CDN`);

  return `${cdnBaseUrl}/${cdnKey}`;
}

// Upload assets separately
async function uploadAssets(
  projectDir: string,
  assets: any,
  appId: string
): Promise<{ icon?: string; banner?: string }> {
  const result: { icon?: string; banner?: string } = {};

  // Helper to get content type for file extension
  const getContentType = (filePath: string): string => {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const types: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      webp: "image/webp",
    };
    return types[ext || ""] || "application/octet-stream";
  };

  // Upload icon if found
  if (assets.icon && assets.icon.length > 0) {
    const iconPath = assets.icon[0];
    const fullPath = `${projectDir}/${iconPath}`;
    try {
      const fileData = await Deno.readFile(fullPath);
      const iconKey = `miniapps/${appId}/assets/icon${iconPath.substring(iconPath.lastIndexOf("."))}`;
      const uploadResult = await uploadFile(iconKey, fileData, getContentType(iconPath));
      result.icon = uploadResult.url;
    } catch (error) {
      console.error(`Failed to upload icon:`, error);
    }
  }

  // Upload banner if found
  if (assets.banner && assets.banner.length > 0) {
    const bannerPath = assets.banner[0];
    const fullPath = `${projectDir}/${bannerPath}`;
    try {
      const fileData = await Deno.readFile(fullPath);
      const bannerKey = `miniapps/${appId}/assets/banner${bannerPath.substring(bannerPath.lastIndexOf("."))}`;
      const uploadResult = await uploadFile(bannerKey, fileData, getContentType(bannerPath));
      result.banner = uploadResult.url;
    } catch (error) {
      console.error(`Failed to upload banner:`, error);
    }
  }

  return result;
}

// Run build command (SECURE: uses argument array instead of shell)
async function runBuild(
  projectDir: string,
  buildCommand: string,
  packageManager: "npm" | "pnpm" | "yarn"
): Promise<{ success: boolean; output: string; error?: string }> {
  // SECURITY FIX: Use argument array instead of shell to prevent command injection
  // Build command is expected to be like "build" or "run build"
  const args = buildCommand.trim().split(/\s+/);

  const buildProcess = new Deno.Command(packageManager, {
    args,
    stdout: "piped",
    stderr: "piped",
    cwd: projectDir,
  });

  try {
    const output = await buildProcess.output();
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);

    return {
      success: true,
      output: stdout + stderr,
    };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: (error as Error).message,
    };
  }
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "miniapp-build", auth);
  if (rl) return rl;

  // Check if user is admin
  const { data: isAdmin, error: adminCheckError } = await supabaseAdminCheck(auth.userId);
  if (adminCheckError || !isAdmin) {
    return errorResponse("AUTH_004", "Admin access required", req);
  }

  let body: BuildRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  if (!body.submission_id) {
    return validationError("submission_id", "submission_id is required", req);
  }

  const supabase = createClient(mustGetEnv("SUPABASE_URL"), mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"));

  let tempDir: string | null = null;
  let submission: any = null;

  try {
    // 1. Get submission
    const { data: submissionData, error: fetchError } = await supabase
      .from("miniapp_submissions")
      .select("*")
      .eq("id", body.submission_id)
      .single();

    submission = submissionData;

    if (fetchError || !submission) {
      return notFoundError("Submission", req);
    }

    // 2. Check if can be built
    if (submission.status !== "approved") {
      return errorResponse(
        "VAL_011",
        { message: `Submission must be approved first (current: ${submission.status})` },
        req
      );
    }

    // 3. Update status to building
    await supabase
      .from("miniapp_submissions")
      .update({ status: "building", build_started_at: new Date().toISOString() })
      .eq("id", body.submission_id);

    // 4. Clone repository
    tempDir = await cloneRepo(submission.git_url, submission.branch, false);
    const projectDir = submission.subfolder ? `${tempDir}/${submission.subfolder}` : tempDir;

    // 5. Detect assets and build config
    const assets = await detectAssets(projectDir);
    const buildConfig = await detectBuildConfig(projectDir);

    // 6. Install dependencies (SECURE: use argument array)
    const packageManager = buildConfig.packageManager;
    const installArgs = packageManager === "npm" ? ["install", "--silent"] : ["install"];

    const installProcess = new Deno.Command(packageManager, {
      args: installArgs,
      stdout: "piped",
      stderr: "piped",
      cwd: projectDir,
    });

    const installResult = await installProcess.output();
    if (installResult.code !== 0) {
      const stdout = new TextDecoder().decode(installResult.stdout);
      const stderr = new TextDecoder().decode(installResult.stderr);
      throw new Error(`Dependency installation failed:\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`);
    }

    // 7. Run build
    const buildResult = await runBuild(projectDir, buildConfig.buildCommand, packageManager);

    if (!buildResult.success) {
      await supabase
        .from("miniapp_submissions")
        .update({
          status: "build_failed",
          last_error: buildResult.error,
          build_log: buildResult.output,
          error_count: (submission.error_count || 0) + 1,
        })
        .eq("id", body.submission_id);

      return json(
        {
          success: false,
          build_id: body.submission_id,
          status: "build_failed",
          error: buildResult.error,
        } as BuildResponse,
        { status: 500 },
        req
      );
    }

    // 8. Upload to CDN
    const outputDir = buildConfig.outputDir;
    const buildPath = `${projectDir}/${outputDir}`;
    const cdnUrl = await uploadToCDN(buildPath, submission.app_id, submission.git_commit_sha);

    // 9. Upload assets
    const assetUrls = await uploadAssets(projectDir, assets, submission.app_id);

    // 10. Update registry
    await supabase
      .from("miniapp_submissions")
      .update({
        status: "published",
        cdn_base_url: cdnUrl,
        cdn_version_path: submission.git_commit_sha,
        assets_selected: assetUrls,
        built_at: new Date().toISOString(),
        built_by: auth.userId,
        build_log: buildResult.output,
      })
      .eq("id", body.submission_id);

    // 11. Clean up
    if (tempDir) {
      await cleanup(tempDir);
    }

    const response: BuildResponse = {
      success: true,
      build_id: body.submission_id,
      status: "published",
      cdn_url: cdnUrl,
    };

    return json(response, {}, req);
  } catch (error) {
    // Clean up on error
    if (tempDir) {
      await cleanup(tempDir);
    }

    // Update submission with error
    await supabase
      .from("miniapp_submissions")
      .update({
        status: "build_failed",
        last_error: (error as Error).message,
        error_count: (submission?.error_count || 0) + 1,
      })
      .eq("id", body.submission_id);

    console.error("Build error:", error);
    return errorResponse("SERVER_001", { message: (error as Error).message }, req);
  }
}

// Admin check helper (SECURE: proper null handling)
async function supabaseAdminCheck(userId: string): Promise<{
  data: boolean;
  error: string | null;
}> {
  const supabase = createClient(mustGetEnv("SUPABASE_URL"), mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"));

  // SECURITY FIX: Use .single() to ensure we get exactly one result or error
  const { data, error } = await supabase.from("admin_emails").select("*").eq("user_id", userId).single();

  // Return true only if we successfully found an admin record
  return {
    data: !error && data !== null,
    error: error ? error.message : null,
  };
}

if (import.meta.main) {
  Deno.serve(handler);
}
