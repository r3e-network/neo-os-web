import type { NextApiRequest, NextApiResponse } from "next";
import type { ForumReply } from "@/components/features/forum/types";
import { apiError } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import {
  getServerSupabaseClient,
  hasServiceRoleSupabase,
  isServerSupabaseConfigured,
} from "@/lib/server-supabase";
import {
  formatWalletDisplayName,
  isValidWalletAddress,
  resolveUserIdFromWallet,
} from "@/lib/wallet-user";
import { requireWalletAuth } from "@/lib/require-wallet-auth";
import {
  getSocialNetworkScope,
  scopedSocialAppId,
} from "@/lib/social-network-scope";

type ForumReplyRow = {
  id: string;
  thread_id: string;
  author_wallet: string;
  author_name: string;
  content: string;
  is_solution: boolean;
  upvotes: number;
  created_at: string;
};

function toReply(row: ForumReplyRow): ForumReply {
  return {
    id: row.id,
    thread_id: row.thread_id,
    author_id: row.author_wallet,
    author_name: row.author_name,
    content: row.content,
    is_solution: row.is_solution,
    upvotes: row.upvotes,
    created_at: row.created_at,
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;

  const { appId, threadId } = req.query;

  if (
    !appId ||
    !threadId ||
    typeof appId !== "string" ||
    typeof threadId !== "string"
  ) {
    return apiError.badRequest(res, "Missing parameters");
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(appId)) {
    return apiError.badRequest(res, "Invalid appId format");
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      threadId,
    )
  ) {
    return apiError.badRequest(res, "Invalid threadId format");
  }

  if (req.method === "GET") {
    return getReplies(appId, threadId, req, res);
  }

  if (req.method === "POST") {
    return createReply(appId, threadId, req, res);
  }

  return apiError.methodNotAllowed(res);
}

export default withCsrfProtection(handler);

async function getReplies(
  appId: string,
  threadId: string,
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!isServerSupabaseConfigured()) {
    res.status(200).json({ replies: [] });
    return;
  }

  const supabase = getServerSupabaseClient();
  const network = getSocialNetworkScope(req.query.network);
  const scopedAppId = scopedSocialAppId(appId, network);
  if (!supabase) {
    res.status(200).json({ replies: [] });
    return;
  }

  const { data, error } = await supabase
    .from("forum_replies")
    .select(
      "id,thread_id,author_wallet,author_name,content,is_solution,upvotes,created_at",
    )
    .eq("app_id", scopedAppId)
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    logger.error(
      "Failed to fetch forum replies:",
      error instanceof Error ? error.message : String(error),
    );
    return apiError.internal(res, "Failed to fetch replies");
  }

  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
  res
    .status(200)
    .json({ replies: ((data || []) as ForumReplyRow[]).map(toReply) });
  return;
}

async function createReply(
  appId: string,
  threadId: string,
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (!hasServiceRoleSupabase()) {
    return apiError.configError(
      res,
      "SUPABASE_SERVICE_ROLE_KEY is required for forum writes",
    );
  }

  let authedWallet: string | null;
  try {
    authedWallet = await requireWalletAuth(req, res);
  } catch (err) {
    logger.error(
      "requireWalletAuth error:",
      err instanceof Error ? err.message : String(err),
    );
    return apiError.internal(res, "Authentication failed");
  }
  if (!authedWallet) return;

  const { wallet, content } = req.body;
  const network = getSocialNetworkScope(req.query.network, req.body?.network);
  const scopedAppId = scopedSocialAppId(appId, network);

  if (!isValidWalletAddress(wallet)) {
    return apiError.badRequest(res, "Invalid wallet address");
  }
  if (wallet !== authedWallet) {
    return apiError.forbidden(res, "Wallet mismatch");
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    return apiError.badRequest(res, "Missing content");
  }
  const safeContent = content.trim();
  if (safeContent.length > 2000) {
    return apiError.badRequest(res, "Reply exceeds maximum length");
  }

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(
      res,
      "Supabase service role client unavailable",
    );
  }

  const { data: thread, error: threadError } = await supabase
    .from("forum_threads")
    .select("id,is_locked")
    .eq("id", threadId)
    .eq("app_id", scopedAppId)
    .single();

  if (threadError || !thread) {
    return apiError.notFound(res, "Thread not found");
  }
  if (thread.is_locked) {
    return apiError.forbidden(res, "Thread is locked");
  }

  const userId = await resolveUserIdFromWallet(supabase, wallet, {
    createIfMissing: true,
  });
  if (!userId) {
    return apiError.internal(res, "Failed to resolve user");
  }

  const { data, error } = await supabase
    .from("forum_replies")
    .insert({
      app_id: scopedAppId,
      thread_id: threadId,
      author_user_id: userId,
      author_wallet: wallet,
      author_name: formatWalletDisplayName(wallet),
      content: safeContent,
    })
    .select(
      "id,thread_id,author_wallet,author_name,content,is_solution,upvotes,created_at",
    )
    .single();

  if (error || !data) {
    logger.error(
      "Failed to create forum reply:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError.internal(res, "Failed to create reply");
  }

  res.status(201).json({ reply: toReply(data as ForumReplyRow) });
  return;
}
