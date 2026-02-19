import type { NextApiRequest, NextApiResponse } from "next";
import type { SocialComment } from "@/components/types";
import { apiError } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient, hasServiceRoleSupabase, isServerSupabaseConfigured } from "@/lib/server-supabase";
import { isValidWalletAddress, resolveUserIdFromWallet } from "@/lib/wallet-user";

type SocialCommentRow = {
  id: string;
  app_id: string;
  author_user_id: string;
  parent_id: string | null;
  content: string;
  is_developer_reply: boolean;
  created_at: string;
  updated_at: string;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return apiError.badRequest(res, "Missing appId");
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(appId)) {
    return apiError.badRequest(res, "Invalid appId format");
  }

  switch (req.method) {
    case "GET":
      return getComments(appId, req, res);
    case "POST":
      return createComment(appId, req, res);
    default:
      return apiError.methodNotAllowed(res);
  }
}

async function getComments(appId: string, req: NextApiRequest, res: NextApiResponse) {
  if (!isServerSupabaseConfigured()) {
    return res.status(200).json({ comments: [], hasMore: false, total: 0 });
  }

  return getCommentsFromDB(appId, req, res);
}

async function getCommentsFromDB(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const parentId = req.query.parent_id as string | undefined;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
  const offset = Math.min(Math.max(parseInt(req.query.offset as string) || 0, 0), 10000);
  if (parentId && parentId !== "null" && !/^[0-9a-f-]{36}$/i.test(parentId)) {
    return apiError.badRequest(res, "Invalid parent_id");
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return res.status(200).json({ comments: [], hasMore: false, total: 0 });
  }

  let query = supabase
    .from("social_comments")
    .select("id,app_id,author_user_id,parent_id,content,is_developer_reply,created_at,updated_at", { count: "exact" })
    .eq("app_id", appId)
    .is("deleted_at", null);

  if (parentId && parentId !== "null") {
    query = query.eq("parent_id", parentId);
  } else {
    query = query.is("parent_id", null);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error("Failed to fetch comments:", error.message);
    return apiError.internal(res, "Failed to fetch comments");
  }

  const rows = (data || []) as SocialCommentRow[];
  const commentIds = rows.map((row) => row.id);
  const voteMap = new Map<string, { upvotes: number; downvotes: number }>();
  const replyCountMap = new Map<string, number>();

  if (commentIds.length > 0) {
    const { data: votes } = await supabase
      .from("social_comment_votes")
      .select("comment_id,vote_type")
      .in("comment_id", commentIds);

    for (const vote of votes || []) {
      const current = voteMap.get(vote.comment_id) || { upvotes: 0, downvotes: 0 };
      if (vote.vote_type === "upvote") current.upvotes += 1;
      if (vote.vote_type === "downvote") current.downvotes += 1;
      voteMap.set(vote.comment_id, current);
    }

    const { data: replies } = await supabase
      .from("social_comments")
      .select("parent_id")
      .in("parent_id", commentIds)
      .is("deleted_at", null);

    for (const reply of replies || []) {
      if (!reply.parent_id) continue;
      replyCountMap.set(reply.parent_id, (replyCountMap.get(reply.parent_id) || 0) + 1);
    }
  }

  const comments: SocialComment[] = rows
    .map((row) => ({
      id: row.id,
      app_id: row.app_id,
      author_user_id: row.author_user_id,
      parent_id: row.parent_id,
      content: row.content,
      is_developer_reply: row.is_developer_reply,
      upvotes: voteMap.get(row.id)?.upvotes || 0,
      downvotes: voteMap.get(row.id)?.downvotes || 0,
      reply_count: replyCountMap.get(row.id) || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))
    .sort((a, b) => {
      const scoreA = a.upvotes - a.downvotes;
      const scoreB = b.upvotes - b.downvotes;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return res.status(200).json({
    comments,
    hasMore: offset + limit < (count || 0),
    total: count || 0,
  });
}

async function createComment(appId: string, req: NextApiRequest, res: NextApiResponse) {
  if (!hasServiceRoleSupabase()) {
    return apiError.configError(res, "SUPABASE_SERVICE_ROLE_KEY is required for comment writes");
  }

  const { wallet, content, parent_id } = req.body;

  if (!isValidWalletAddress(wallet)) {
    return apiError.badRequest(res, "Invalid wallet address");
  }
  if (!content?.trim() || typeof content !== "string") {
    return apiError.badRequest(res, "Missing content");
  }
  if (content.trim().length > 2000) {
    return apiError.badRequest(res, "Comment too long");
  }
  if (parent_id && (typeof parent_id !== "string" || !/^[0-9a-f-]{36}$/i.test(parent_id))) {
    return apiError.badRequest(res, "Invalid parent_id");
  }

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(res, "Supabase service role client unavailable");
  }

  const userId = await resolveUserIdFromWallet(supabase, wallet, { createIfMissing: true });
  if (!userId) {
    return apiError.internal(res, "Failed to resolve user");
  }

  if (parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from("social_comments")
      .select("id,app_id")
      .eq("id", parent_id)
      .is("deleted_at", null)
      .single();

    if (parentError || !parent) {
      return apiError.notFound(res, "Parent comment not found");
    }
    if (parent.app_id !== appId) {
      return apiError.badRequest(res, "Parent comment belongs to different app");
    }
  }

  let isDeveloperReply = false;
  const { data: miniapp } = await supabase
    .from("miniapps")
    .select("developer_user_id")
    .eq("app_id", appId)
    .maybeSingle();
  if (miniapp?.developer_user_id && miniapp.developer_user_id === userId) {
    isDeveloperReply = true;
  }

  const { data, error } = await supabase
    .from("social_comments")
    .insert({
      app_id: appId,
      author_user_id: userId,
      parent_id: parent_id || null,
      content: content.trim(),
      is_developer_reply: isDeveloperReply,
    })
    .select("id,app_id,author_user_id,parent_id,content,is_developer_reply,created_at,updated_at")
    .single();

  if (error || !data) {
    logger.error("Failed to create comment:", error?.message || "unknown error");
    return apiError.internal(res, "Failed to create comment");
  }

  const comment: SocialComment = {
    id: data.id,
    app_id: data.app_id,
    author_user_id: data.author_user_id,
    parent_id: data.parent_id,
    content: data.content,
    is_developer_reply: data.is_developer_reply,
    upvotes: 0,
    downvotes: 0,
    reply_count: 0,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };

  return res.status(201).json({ comment });
}

export default withCsrfProtection(handler);
