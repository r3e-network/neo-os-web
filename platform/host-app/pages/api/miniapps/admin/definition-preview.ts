import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { strictLimit } from "@/lib/rate-limit";
import { parseMiniAppDefinitionContent } from "@/lib/miniapp-definitions";
import { validateMiniAppDefinitionAgainstSchema } from "@/lib/miniapp-schema-validator";
import { coerceMiniAppInfo } from "@/lib/miniapp";

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function toBodyString(body: unknown): string {
  if (typeof body === "string") return body;
  const obj = asObject(body);
  const content = obj.content;
  if (typeof content === "string") return content;
  return "";
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
  if (strictLimit(req, res)) return;

  const admin = await requireMiniAppAdmin(req, res);
  if (!admin) return;

  const content = toBodyString(req.body);
  if (!content.trim()) {
    return apiError.badRequest(
      res,
      "content is required and must be JSON or YAML text",
    );
  }

  let parsed: unknown;
  try {
    parsed = parseMiniAppDefinitionContent(content);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "invalid definition content";
    return apiError.badRequest(res, message);
  }

  const schemaValidation = validateMiniAppDefinitionAgainstSchema(parsed);
  if (!schemaValidation.valid) {
    return apiError.badRequest(
      res,
      schemaValidation.error || "definition schema validation failed",
    );
  }

  const payload = asObject(parsed);
  const preview = coerceMiniAppInfo(payload);
  if (!preview) {
    return apiError.badRequest(
      res,
      "definition parsed but cannot be normalized into a miniapp preview",
    );
  }

  res.setHeader("Cache-Control", "no-store, private");
  res.status(200).json({
    actor: admin.kind,
    parsed_definition: payload,
    preview,
  });
  return;
}

export default withCsrfProtection(handler);
