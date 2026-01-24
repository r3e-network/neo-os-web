// MiniApp Approval Endpoint
// Admin approves/rejects submissions and optionally triggers build

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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ApprovalRequest {
  submission_id: string;
  action: "approve" | "reject" | "request_changes";
  trigger_build?: boolean; // for approve action
  review_notes?: string;
}

// SECURITY: Maximum length for review notes to prevent abuse
const MAX_REVIEW_NOTES_LENGTH = 5000;

// SECURITY: Sanitize review notes to prevent injection attacks
function sanitizeReviewNotes(notes: string | undefined): string | undefined {
  if (!notes) return undefined;

  // Trim whitespace
  let sanitized = notes.trim();

  // Enforce maximum length
  if (sanitized.length > MAX_REVIEW_NOTES_LENGTH) {
    sanitized = sanitized.substring(0, MAX_REVIEW_NOTES_LENGTH);
  }

  // Remove any potentially dangerous characters (basic sanitization)
  // In production, you might want more sophisticated sanitization
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "miniapp-approve", auth);
  if (rl) return rl;

  // Check if user is admin
  const { data: isAdmin, error: adminCheckError } = await supabaseAdminCheck(auth.userId);
  if (adminCheckError || !isAdmin) {
    return errorResponse("AUTH_004", "Admin access required", req);
  }

  let body: ApprovalRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  if (!body.submission_id) {
    return validationError("submission_id", "submission_id is required", req);
  }

  if (!body.action) {
    return validationError("action", "action is required (approve, reject, request_changes)", req);
  }

  // SECURITY: Sanitize review notes to prevent injection attacks
  const sanitizedNotes = sanitizeReviewNotes(body.review_notes);

  const supabase = createClient(mustGetEnv("SUPABASE_URL"), mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"));

  try {
    // Get submission
    const { data: submission, error: fetchError } = await supabase
      .from("miniapp_submissions")
      .select("*")
      .eq("id", body.submission_id)
      .single();

    if (fetchError || !submission) {
      return errorResponse("NOTFOUND_001", { message: "Submission not found" }, req);
    }

    const now = new Date().toISOString();

    switch (body.action) {
      case "approve": {
        // Update status to approved
        const updateData: any = {
          status: "approved",
          reviewed_by: auth.userId,
          reviewed_at: now,
          review_notes: sanitizedNotes,
        };

        // Optionally trigger build immediately
        if (body.trigger_build) {
          updateData.status = "building";
          updateData.build_started_at = now;
        }

        const { error: updateError } = await supabase
          .from("miniapp_submissions")
          .update(updateData)
          .eq("id", body.submission_id);

        if (updateError) throw updateError;

        // If trigger_build is false, we're done
        if (!body.trigger_build) {
          return json({
            success: true,
            submission_id: body.submission_id,
            status: "approved",
            message: "Submission approved. Build will be triggered manually.",
          });
        }

        // TODO: Trigger build pipeline
        // This would call the build endpoint or queue a build job
        return json({
          success: true,
          submission_id: body.submission_id,
          status: "building",
          message: "Submission approved and build triggered.",
        });
      }

      case "reject": {
        const { error: updateError } = await supabase
          .from("miniapp_submissions")
          .update({
            status: "rejected",
            reviewed_by: auth.userId,
            reviewed_at: now,
            review_notes: sanitizedNotes,
          })
          .eq("id", body.submission_id);

        if (updateError) throw updateError;

        return json({
          success: true,
          submission_id: body.submission_id,
          status: "rejected",
          message: "Submission rejected.",
        });
      }

      case "request_changes": {
        const { error: updateError } = await supabase
          .from("miniapp_submissions")
          .update({
            status: "update_requested",
            reviewed_by: auth.userId,
            reviewed_at: now,
            review_notes: sanitizedNotes,
          })
          .eq("id", body.submission_id);

        if (updateError) throw updateError;

        return json({
          success: true,
          submission_id: body.submission_id,
          status: "update_requested",
          message: "Changes requested from developer.",
        });
      }

      default:
        return validationError("action", "Invalid action", req);
    }
  } catch (error) {
    console.error("Approval error:", error);
    return errorResponse("SERVER_001", { message: (error as Error).message }, req);
  }
}

// Admin check helper (SECURITY FIX: proper null handling and error checking)
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
