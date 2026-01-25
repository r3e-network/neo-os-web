// MiniApp Publish Endpoint
// Updates submission record after external build pipeline publishes assets

import "../_shared/init.ts";

declare const Deno: {
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { mustGetEnv, getEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, forbiddenError, validationError, notFoundError } from "../_shared/error-codes.ts";
import { validatePublishPayload } from "../_shared/miniapps/publish-validation.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface PublishRequest {
  submission_id: string;
  entry_url: string;
  cdn_base_url: string;
  cdn_version_path?: string;
  assets?: {
    icon?: string;
    banner?: string;
  };
  assets_selected?: {
    icon?: string;
    banner?: string;
  };
  build_log?: string;
}

interface PublishResponse {
  success: boolean;
  submission_id: string;
  status: string;
  cdn_url: string;
}

function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return false;
  const token = authHeader.slice("bearer ".length).trim();
  if (!token) return false;
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") ?? getEnv("SUPABASE_SERVICE_KEY");
  if (!serviceKey) return false;
  return token === serviceKey;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  if (!isServiceRoleRequest(req)) {
    return forbiddenError("service role required", req);
  }

  let body: PublishRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  if (!body.submission_id) {
    return validationError("submission_id", "submission_id is required", req);
  }

  if (!body.entry_url) {
    return validationError("entry_url", "entry_url is required", req);
  }

  if (!body.cdn_base_url) {
    return validationError("cdn_base_url", "cdn_base_url is required", req);
  }

  const supabase = createClient(mustGetEnv("SUPABASE_URL"), mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"));

  try {
    const { data: submission, error: fetchError } = await supabase
      .from("miniapp_submissions")
      .select("id,status,current_version")
      .eq("id", body.submission_id)
      .single();

    if (fetchError || !submission) {
      return notFoundError("Submission", req);
    }

    if (!["approved", "building"].includes(submission.status)) {
      return errorResponse(
        "VAL_011",
        { message: `Submission must be approved or building (current: ${submission.status})` },
        req
      );
    }

    const assets = body.assets_selected ?? body.assets ?? null;
    const publishValidation = validatePublishPayload({
      entryUrl: body.entry_url,
      cdnBaseUrl: body.cdn_base_url ?? null,
      cdnRootUrl: getEnv("CDN_BASE_URL") ?? null,
      assets,
    });

    if (!publishValidation.valid) {
      return errorResponse("VAL_011", { message: publishValidation.errors.join("; ") }, req);
    }
    const versionPath = body.cdn_version_path ?? submission.current_version ?? null;

    const { error: updateError } = await supabase
      .from("miniapp_submissions")
      .update({
        status: "published",
        entry_url: body.entry_url,
        cdn_base_url: body.cdn_base_url,
        cdn_version_path: versionPath,
        assets_selected: assets,
        built_at: new Date().toISOString(),
        built_by: null,
        build_log: body.build_log ?? null,
      })
      .eq("id", body.submission_id);

    if (updateError) throw updateError;

    const response: PublishResponse = {
      success: true,
      submission_id: body.submission_id,
      status: "published",
      cdn_url: body.cdn_base_url,
    };

    return json(response, {}, req);
  } catch (error) {
    console.error("Publish error:", error);
    return errorResponse("SERVER_ERROR", { message: (error as Error).message }, req);
  }
}

if (import.meta.main) {
  Deno.serve(handler);
}
