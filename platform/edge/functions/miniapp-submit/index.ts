// MiniApp Submission Endpoint
// External developers submit their source code via Git URL for review

import "../_shared/init.ts";

declare const Deno: {
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { requireAuth } from "../_shared/supabase.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { cloneRepo, getCommitInfo, cleanup, normalizeGitUrl, parseGitUrl } from "../_shared/build/git-manager.ts";
import { detectAssets, readManifest, validateManifest, hasPrebuiltFiles } from "../_shared/build/asset-detector.ts";
import { detectBuildConfig, validateBuildSetup } from "../_shared/build/build-detector.ts";
import { isAutoApprovedInternalRepo, isServiceRoleRequest } from "./internal-approval.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SubmitRequest {
  git_url: string;
  subfolder?: string;
  branch?: string;
}

interface SubmissionResponse {
  submission_id: string;
  status: string;
  detected: {
    manifest: boolean;
    assets: {
      icon?: string[];
      banner?: string[];
      screenshot?: string[];
    };
    build_type: string;
    build_config: {
      build_command: string;
      output_dir: string;
      package_manager: string;
    };
  };
  warnings?: string[];
  errors?: string[];
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const isServiceRole = isServiceRoleRequest(req);
  const auth = isServiceRole ? null : await requireAuth(req);
  if (!isServiceRole && auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "miniapp-submit", auth ?? undefined);
  if (rl) return rl;
  if (auth) {
    const scopeCheck = requireScope(req, auth, "miniapp-submit");
    if (scopeCheck) return scopeCheck;
  }

  let body: SubmitRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  // Validate required fields
  if (!body.git_url) {
    return validationError("git_url", "git_url is required", req);
  }

  const supabase = createClient(mustGetEnv("SUPABASE_URL"), mustGetEnv("SUPABASE_ANON_KEY"));

  let tempDir: string | null = null;
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Parse and normalize Git URL
    const normalizedUrl = normalizeGitUrl(body.git_url);
    const gitInfo = parseGitUrl(body.git_url);
    const branch = body.branch || "main";
    const subfolder = body.subfolder || "";
    const autoApproved = isServiceRole && isAutoApprovedInternalRepo(normalizedUrl);
    const reviewedAt = autoApproved ? new Date().toISOString() : null;
    const reviewNotes = autoApproved ? "auto-approved internal repo submission" : null;

    // 2. Clone repository temporarily
    tempDir = await cloneRepo(normalizedUrl, branch, true);
    const projectDir = subfolder ? `${tempDir}/${subfolder}` : tempDir;

    // 3. Check for pre-built files (should reject)
    const prebuiltCheck = await hasPrebuiltFiles(projectDir);
    if (prebuiltCheck.hasPrebuilt) {
      errors.push(
        `Pre-built files detected: ${prebuiltCheck.detectedFiles.join(", ")}. Please submit source code only.`
      );
    }

    // 4. Detect and read manifest
    const assets = await detectAssets(projectDir);
    if (!assets.manifest) {
      errors.push("No manifest file found (manifest.json, neo-manifest.json, or package.json)");
    }

    let manifest = {};
    let manifestHash = "";
    let appId = "";

    if (assets.manifest) {
      try {
        manifest = await readManifest(projectDir);
        const validation = validateManifest(manifest);
        if (!validation.valid) {
          errors.push(...validation.errors);
        }

        // Extract app_id
        appId = (manifest as any).app_id || "";

        // Generate manifest hash
        const manifestString = JSON.stringify(manifest);
        const encoder = new TextEncoder();
        const data = encoder.encode(manifestString);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        manifestHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch (error) {
        errors.push(`Failed to read manifest: ${(error as Error).message}`);
      }
    }

    // 5. Detect build configuration
    const buildConfig = await detectBuildConfig(projectDir);
    const buildValidation = await validateBuildSetup(projectDir);
    warnings.push(...buildValidation.warnings);

    // 6. If there are errors, return them
    if (errors.length > 0) {
      return json(
        {
          success: false,
          errors,
          warnings,
        },
        { status: 400 },
        req
      );
    }

    // 7. Get commit info
    const commitInfo = await getCommitInfo(tempDir);

    // 8. Store submission in database
    const { data: submission, error: insertError } = await supabase
      .from("miniapp_submissions")
      .insert({
        git_url: normalizedUrl,
        git_host: gitInfo.host,
        repo_owner: gitInfo.owner,
        repo_name: gitInfo.name,
        subfolder: subfolder || null,
        branch,
        git_commit_sha: commitInfo.sha,
        git_commit_message: commitInfo.message,
        git_committer: commitInfo.author,
        git_committed_at: commitInfo.date,
        app_id: appId,
        manifest,
        manifest_hash,
        assets_detected: assets,
        build_config: buildConfig,
        status: autoApproved ? "building" : "pending_review",
        submitted_by: auth?.userId ?? null,
        reviewed_at: reviewedAt,
        review_notes: reviewNotes,
        current_version: commitInfo.sha,
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    // 9. Clean up temp directory
    if (tempDir) {
      await cleanup(tempDir);
    }

    // 10. Return submission response
    const response: SubmissionResponse = {
      submission_id: submission.id,
      status: autoApproved ? "building" : "pending_review",
      detected: {
        manifest: !!assets.manifest,
        assets: {
          icon: assets.icon,
          banner: assets.banner,
          screenshot: assets.screenshot,
        },
        build_type: buildConfig.type,
        build_config: {
          build_command: buildConfig.buildCommand,
          output_dir: buildConfig.outputDir,
          package_manager: buildConfig.packageManager,
        },
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    return json(response, {}, req);
  } catch (error) {
    // Always clean up temp directory on error
    if (tempDir) {
      await cleanup(tempDir);
    }

    console.error("Submission error:", error);
    return errorResponse("SERVER_ERROR", { message: (error as Error).message }, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
