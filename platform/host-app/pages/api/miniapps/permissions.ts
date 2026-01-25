import type { NextApiRequest, NextApiResponse } from "next";
import { BUILTIN_APPS } from "@/lib/builtin-apps";

interface PermissionsRequest {
  permissions: string[];
}

interface PermissionsResponse {
  allowed: boolean;
  denied: string[];
  app_id: string;
}

export default function handler(req: NextApiRequest, res: NextApiResponse<PermissionsResponse | { error: string }>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { appId, permissions: requestedPermissions } = req.body as PermissionsRequest & { appId: string };

  if (!appId) {
    return res.status(400).json({ error: "app_id is required" });
  }

  const app = BUILTIN_APPS.find((a) => a.app_id === appId);
  if (!app) {
    return res.status(404).json({ error: "Miniapp not found" });
  }

  const appPermissions = app.permissions || {};
  const requested = Array.isArray(requestedPermissions) ? requestedPermissions : [];
  const denied: string[] = [];

  for (const perm of requested) {
    let allowed = false;
    switch (perm) {
      case "payments":
        allowed = Boolean(appPermissions.payments);
        break;
      case "governance":
        allowed = Boolean(appPermissions.governance);
        break;
      case "rng":
        allowed = Boolean(appPermissions.rng);
        break;
      case "datafeed":
        allowed = Boolean(appPermissions.datafeed);
        break;
      case "automation":
        allowed = Boolean(appPermissions.automation);
        break;
      case "confidential":
        allowed = Boolean(appPermissions.confidential);
        break;
      default:
        allowed = false;
    }
    if (!allowed) {
      denied.push(perm);
    }
  }

  return res.status(200).json({
    allowed: denied.length === 0,
    denied,
    app_id: appId,
  });
}
