import type { NextApiRequest, NextApiResponse } from "next";
import type { ForumThread } from "@/components/features/forum/types";
import { apiError } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient, hasServiceRoleSupabase, isServerSupabaseConfigured } from "@/lib/server-supabase";
import { formatWalletDisplayName, isValidWalletAddress, resolveUserIdFromWallet } from "@/lib/wallet-user";
import { requireWalletAuth } from "@/lib/require-wallet-auth";

type ForumThreadRow = {
  id: string;
  app_id: string;
  author_wallet: string;
  author_name: string;
  title: string;
  content: string;
  category: "general" | "bug" | "feature" | "help";
  reply_count: number;
  view_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  last_reply_at: string | null;
};

const VALID_CATEGORIES = ["general", "bug", "feature", "help"] as const;

function toThread(row: ForumThreadRow): ForumThread {
  return {
    id: row.id,
    app_id: row.app_id,
    author_id: row.author_wallet,
    author_name: row.author_name,
    title: row.title,
    content: row.content,
    category: row.category,
    reply_count: row.reply_count,
    view_count: row.view_count,
    is_pinned: row.is_pinned,
    is_locked: row.is_locked,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_reply_at: row.last_reply_at,
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return apiError.badRequest(res, "Missing appId");
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(appId)) {
    return apiError.badRequest(res, "Invalid appId format");
  }

  if (req.method === "GET") {
    return getThreads(appId, req, res);
  }

  if (req.method === "POST") {
    return createThread(appId, req, res);
  }

  return apiError.methodNotAllowed(res);
}

export default withCsrfProtection(handler);

async function getThreads(appId: string, req: NextApiRequest, res: NextApiResponse) {
  if (!isServerSupabaseConfigured()) {
    return res.status(200).json({ threads: [], hasMore: false, total: 0 });
  }

  const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
  if (category && !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return apiError.badRequest(res, "Invalid category");
  }

  const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 20, 50));
  const offset = Math.max(0, Math.min(parseInt(req.query.offset as string) || 0, 10000));
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return res.status(200).json({ threads: [], hasMore: false, total: 0 });
  }

  let query = supabase
    .from("forum_threads")
    .select(
      "id,app_id,author_wallet,author_name,title,content,category,reply_count,view_count,is_pinned,is_locked,created_at,updated_at,last_reply_at",
      { count: "exact" },
    )
    .eq("app_id", appId);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error, count } = await query
    .order("is_pinned", { ascending: false })
    .order("last_reply_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error("Failed to fetch forum threads:", error.message);
    return apiError.internal(res, "Failed to fetch threads");
  }

  const threads = ((data || []) as ForumThreadRow[]).map(toThread);

  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
  return res.status(200).json({
    threads,
    hasMore: offset + limit < (count || 0),
    total: count || 0,
  });
}

async function createThread(appId: string, req: NextApiRequest, res: NextApiResponse) {
  if (!hasServiceRoleSupabase()) {
    return apiError.configError(res, "SUPABASE_SERVICE_ROLE_KEY is required for forum writes");
  }

  const authedWallet = await requireWalletAuth(req, res);
  if (!authedWallet) return;

  const { wallet, title, content, category } = req.body;

  if (!isValidWalletAddress(wallet)) {
    return apiError.badRequest(res, "Invalid wallet address");
  }
  if (wallet !== authedWallet) {
    return apiError.forbidden(res, "Wallet mismatch");
  }

  if (!title?.trim() || !content?.trim() || typeof title !== "string" || typeof content !== "string") {
    return apiError.badRequest(res, "Missing required fields");
  }

  const safeTitle = title.trim();
  const safeContent = content.trim();
  if (safeTitle.length > 200 || safeContent.length > 5000) {
    return apiError.badRequest(res, "Thread exceeds maximum length");
  }

  const safeCategory = typeof category === "string" && VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])
    ? category
    : "general";

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(res, "Supabase service role client unavailable");
  }

  const userId = await resolveUserIdFromWallet(supabase, wallet, { createIfMissing: true });
  if (!userId) {
    return apiError.internal(res, "Failed to resolve user");
  }

  const { data, error } = await supabase
    .from("forum_threads")
    .insert({
      app_id: appId,
      author_user_id: userId,
      author_wallet: wallet,
      author_name: formatWalletDisplayName(wallet),
      title: safeTitle,
      content: safeContent,
      category: safeCategory,
    })
    .select(
      "id,app_id,author_wallet,author_name,title,content,category,reply_count,view_count,is_pinned,is_locked,created_at,updated_at,last_reply_at",
    )
    .single();

  if (error || !data) {
    logger.error("Failed to create forum thread:", error?.message || "unknown error");
    return apiError.internal(res, "Failed to create thread");
  }

  return res.status(201).json({ thread: toThread(data as ForumThreadRow) });
}
