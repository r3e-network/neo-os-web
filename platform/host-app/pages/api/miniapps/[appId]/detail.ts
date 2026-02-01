import type { NextApiRequest, NextApiResponse } from "next";
import type { MiniAppInfo } from "@/components/types";
import { getBuiltinApp } from "@/lib/builtin-apps";
import { fetchCommunityAppById } from "@/lib/community-apps";

type DetailResponse = { app: MiniAppInfo };
type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DetailResponse | ErrorResponse>,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const appId = Array.isArray(req.query.appId) ? req.query.appId[0] : req.query.appId;
  if (!appId) {
    return res.status(400).json({ error: "Missing appId" });
  }

  const builtin = getBuiltinApp(appId);
  if (builtin) {
    return res.status(200).json({
      app: {
        ...builtin,
        source: builtin.source ?? "builtin",
      },
    });
  }

  const community = await fetchCommunityAppById(appId);
  if (community) {
    return res.status(200).json({ app: community });
  }

  return res.status(404).json({ error: "App not found" });
}
