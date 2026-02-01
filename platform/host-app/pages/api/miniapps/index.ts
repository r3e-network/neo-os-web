import type { NextApiRequest, NextApiResponse } from "next";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import type { MiniAppInfo } from "@/components/types";
import type { ChainId } from "@/lib/chains/types";

interface ListQuery {
  category?: string;
  status?: string;
  chain?: string;
  search?: string;
}

function filterApps(apps: MiniAppInfo[], query: ListQuery): MiniAppInfo[] {
  let result = apps;

  if (query.category) {
    result = result.filter((app) => app.category === query.category);
  }

  if (query.status) {
    result = result.filter((app) => app.status === query.status);
  }

  if (query.chain) {
    const chainId = query.chain as ChainId;
    result = result.filter((app) => 
      app.supportedChains?.includes(chainId) ||
      app.chainContracts?.[chainId]?.active
    );
  }

  if (query.search) {
    const searchLower = query.search.toLowerCase();
    result = result.filter((app) =>
      app.name.toLowerCase().includes(searchLower) ||
      app.name_zh?.toLowerCase().includes(searchLower) ||
      app.description.toLowerCase().includes(searchLower) ||
      app.description_zh?.toLowerCase().includes(searchLower)
    );
  }

  return result;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req;

  switch (req.method) {
    case "GET": {
      const listQuery = query as ListQuery;

      if (query.appId) {
        const app = BUILTIN_APPS.find((a) => a.app_id === query.appId);
        if (!app) {
          return res.status(404).json({ error: "Miniapp not found" });
        }
        return res.status(200).json({ manifest: app });
      }

      const filtered = filterApps(BUILTIN_APPS, listQuery);

      const registry: Record<string, MiniAppInfo[]> = {};
      for (const app of filtered) {
        if (!registry[app.category]) {
          registry[app.category] = [];
        }
        registry[app.category].push(app);
      }

      return res.status(200).json(registry);
    }

    default:
      res.setHeader("Allow", ["GET"]);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
