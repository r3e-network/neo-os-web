import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { withCsrfProtection } from "@/lib/csrf";
import { strictLimit } from "@/lib/rate-limit";
import { createMiniAppMediaUploadUrl, isMiniAppMediaUploadConfigured, type MiniAppMediaAssetKind } from "@/lib/r2-media";

const APP_ID_REGEX = /^[a-z0-9][a-z0-9._-]*$/;

type Dict = Record<string, unknown>;

function asTrimmedString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function asObject(value: unknown): Dict {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Dict;
}

function normalizeAssetType(value: unknown): MiniAppMediaAssetKind | null {
  const raw = asTrimmedString(value).toLowerCase();
  if (raw === "icon" || raw === "logo" || raw === "banner") {
    return raw;
  }
  return null;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
  if (strictLimit(req, res)) return;

  const admin = await requireMiniAppAdmin(req, res);
  if (!admin) return;

  if (!isMiniAppMediaUploadConfigured()) {
    return apiError.configError(
      res,
      "Cloudflare R2 media upload not configured. Set MINIAPP_R2_ACCOUNT_ID, MINIAPP_R2_ACCESS_KEY_ID, MINIAPP_R2_SECRET_ACCESS_KEY.",
    );
  }

  const body = asObject(req.body);
  const appId = asTrimmedString(body.app_id).toLowerCase();
  const assetType = normalizeAssetType(body.asset_type);
  const contentType = asTrimmedString(body.content_type).toLowerCase();
  const fileName = asTrimmedString(body.file_name);
  const variant = asObject(body.variant);

  if (!APP_ID_REGEX.test(appId)) {
    return apiError.badRequest(res, "Invalid app_id format");
  }
  if (!assetType) {
    return apiError.badRequest(res, "asset_type must be icon, logo, or banner");
  }
  if (!contentType) {
    return apiError.badRequest(res, "content_type is required");
  }

  try {
    const result = await createMiniAppMediaUploadUrl({
      app_id: appId,
      asset_type: assetType,
      content_type: contentType,
      file_name: fileName || undefined,
      variant: {
        theme: asTrimmedString(variant.theme).toLowerCase() as "light" | "dark" | "any" | undefined,
        density: asTrimmedString(variant.density).toLowerCase() as "1x" | "2x" | "3x" | undefined,
        locale: asTrimmedString(variant.locale) || undefined,
      },
    });

    res.setHeader("Cache-Control", "no-store, private");
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate upload URL";
    return apiError.badRequest(res, message);
  }
}

export default withCsrfProtection(handler);
