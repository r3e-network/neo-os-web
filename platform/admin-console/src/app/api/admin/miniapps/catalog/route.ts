import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;
const CATEGORY_SET = new Set(["gaming", "defi", "social", "nft", "governance", "utility"]);
const VALID_CHAIN_ID = /^[a-z0-9]+-[a-z0-9]+(-[a-z0-9]+)*$/;

type SupabaseMethod = "GET" | "POST" | "PATCH";

type RuntimeMiniAppConfig = {
  docs?: {
    title: string;
    subtitle?: string;
    steps?: string[];
    features?: Array<{ name: string; description: string }>;
  };
  operation?: Record<string, unknown>;
  buttons?: Array<Record<string, unknown>>;
};

type CatalogUpsertBody = {
  app_id: string;
  name: string;
  name_zh?: string;
  description: string;
  description_zh?: string;
  short_description?: string;
  category: string;
  entry_url: string;
  chain_id: string;
  contract_address: string;
  icon_url?: string;
  banner_url?: string;
  developer_name?: string;
  developer_address?: string;
  runtime_config?: RuntimeMiniAppConfig;
};

type SupabaseError = {
  message?: string;
  error?: string;
};

function serviceRoleHeaders(serviceRoleKey: string, extra?: HeadersInit): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...(extra || {}),
  };
}

function normalizeAddress(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("0x") ? trimmed.toLowerCase() : `0x${trimmed.toLowerCase()}`;
}

function normalizeRuntimeConfig(raw: unknown): RuntimeMiniAppConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const runtime = raw as RuntimeMiniAppConfig;
  const normalized: RuntimeMiniAppConfig = {};

  if (runtime.docs?.title) {
    normalized.docs = {
      title: String(runtime.docs.title).trim(),
      subtitle: runtime.docs.subtitle ? String(runtime.docs.subtitle).trim() : undefined,
      steps: Array.isArray(runtime.docs.steps)
        ? runtime.docs.steps.map((step) => String(step).trim()).filter(Boolean)
        : undefined,
      features: Array.isArray(runtime.docs.features)
        ? runtime.docs.features
            .map((feature) => ({
              name: String(feature?.name || "").trim(),
              description: String(feature?.description || "").trim(),
            }))
            .filter((feature) => feature.name)
        : undefined,
    };
  }

  if (runtime.operation && typeof runtime.operation === "object" && !Array.isArray(runtime.operation)) {
    normalized.operation = runtime.operation;
  }

  if (Array.isArray(runtime.buttons)) {
    normalized.buttons = runtime.buttons.filter(
      (button) => button && typeof button === "object" && !Array.isArray(button)
    );
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

async function supabaseRequest<T>(
  method: SupabaseMethod,
  tableOrPath: string,
  serviceRoleKey: string,
  options?: {
    params?: Record<string, string>;
    body?: unknown;
    headers?: HeadersInit;
  }
): Promise<{ data: T; status: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  }

  const url = new URL(`/rest/v1/${tableOrPath}`, supabaseUrl);
  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method,
    headers: serviceRoleHeaders(serviceRoleKey, options?.headers),
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = (await response.json().catch(() => ({}))) as T | SupabaseError;
  if (!response.ok) {
    const err = payload as SupabaseError;
    throw new Error(err.message || err.error || `Supabase ${method} ${tableOrPath} failed`);
  }

  return { data: payload as T, status: response.status };
}

async function fetchLatestVersionCode(serviceRoleKey: string, appId: string): Promise<number> {
  const { data } = await supabaseRequest<Array<{ version_code: number | null }>>("GET", "miniapp_versions", serviceRoleKey, {
    params: {
      select: "version_code",
      app_id: `eq.${appId}`,
      order: "version_code.desc",
      limit: "1",
    },
  });
  const current = data[0]?.version_code;
  return typeof current === "number" && Number.isFinite(current) ? current : 0;
}

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required" }, { status: 500 });
  }

  try {
    const body = (await req.json()) as CatalogUpsertBody;
    const appId = String(body.app_id || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const category = String(body.category || "").trim().toLowerCase();
    const chainId = String(body.chain_id || "").trim().toLowerCase();
    const entryUrl = String(body.entry_url || "").trim();
    const contractAddress = normalizeAddress(String(body.contract_address || ""));

    if (!APP_ID_PATTERN.test(appId)) {
      return NextResponse.json({ error: "app_id must be lowercase kebab-case (3-64 chars)" }, { status: 400 });
    }
    if (!name || !description) {
      return NextResponse.json({ error: "name and description are required" }, { status: 400 });
    }
    if (!CATEGORY_SET.has(category)) {
      return NextResponse.json({ error: `category must be one of: ${Array.from(CATEGORY_SET).join(", ")}` }, { status: 400 });
    }
    if (!VALID_CHAIN_ID.test(chainId)) {
      return NextResponse.json({ error: "chain_id format is invalid" }, { status: 400 });
    }
    if (!entryUrl) {
      return NextResponse.json({ error: "entry_url is required" }, { status: 400 });
    }
    if (!/^0x[0-9a-f]{40}$/i.test(contractAddress)) {
      return NextResponse.json({ error: "contract_address must be a 20-byte Neo script hash (0x + 40 hex)" }, { status: 400 });
    }

    const runtimeConfig = normalizeRuntimeConfig(body.runtime_config);
    const display = {
      name,
      description,
      icon: String(body.icon_url || "").trim() || undefined,
      banner: String(body.banner_url || "").trim() || undefined,
    };

    const metadata = {
      source: "admin-console",
      configured_at: new Date().toISOString(),
      ui_config: runtimeConfig,
      display,
    };

    const contracts = {
      [chainId]: {
        address: contractAddress,
        active: true,
      },
    };

    const supportedChains = [chainId];

    const registryPayload: Record<string, unknown> = {
      app_id: appId,
      developer_address: String(body.developer_address || "platform-admin").trim(),
      developer_name: String(body.developer_name || "Platform Admin").trim(),
      name,
      name_zh: String(body.name_zh || "").trim() || null,
      description,
      description_zh: String(body.description_zh || "").trim() || null,
      short_description: String(body.short_description || "").trim() || null,
      icon_url: String(body.icon_url || "").trim() || null,
      banner_url: String(body.banner_url || "").trim() || null,
      category,
      status: "published",
      visibility: "public",
      supported_chains: supportedChains,
      contracts,
      metadata,
      runtime_config: runtimeConfig || {},
    };

    const registryUpsert = await supabaseRequest<Array<{ id: string; app_id: string }>>(
      "POST",
      "miniapp_registry",
      serviceRoleKey,
      {
        params: {
          on_conflict: "app_id",
          select: "id,app_id",
        },
        body: registryPayload,
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
      }
    );

    const registryRow = registryUpsert.data[0];
    if (!registryRow?.app_id) {
      throw new Error("miniapp_registry upsert returned no row");
    }

    await supabaseRequest<unknown>("PATCH", "miniapp_versions", serviceRoleKey, {
      params: {
        app_id: `eq.${appId}`,
        is_current: "eq.true",
      },
      body: {
        is_current: false,
      },
    }).catch(() => undefined);

    const nextVersionCode = (await fetchLatestVersionCode(serviceRoleKey, appId)) + 1;
    const versionTag = `1.0.${nextVersionCode}`;

    const versionInsert = await supabaseRequest<Array<{ id: string; version: string; version_code: number }>>(
      "POST",
      "miniapp_versions",
      serviceRoleKey,
      {
        params: {
          select: "id,version,version_code",
        },
        body: {
          app_id: appId,
          version: versionTag,
          version_code: nextVersionCode,
          entry_url: entryUrl,
          status: "published",
          is_current: true,
          supported_chains: supportedChains,
          contracts,
          published_at: new Date().toISOString(),
        },
      }
    );

    const versionRow = versionInsert.data[0];
    if (!versionRow?.id) {
      throw new Error("miniapp_versions insert returned no row");
    }

    await supabaseRequest<unknown>("PATCH", "miniapp_registry", serviceRoleKey, {
      params: {
        app_id: `eq.${appId}`,
      },
      body: {
        status: "published",
        visibility: "public",
        lifecycle_status: "active",
        current_version_id: versionRow.id,
        published_at: new Date().toISOString(),
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      app_id: appId,
      version: versionRow.version,
      version_code: versionRow.version_code,
      registry_id: registryRow.id,
      version_id: versionRow.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save miniapp catalog entry", details: (error as Error).message },
      { status: 500 }
    );
  }
}

