import type { NextApiRequest, NextApiResponse } from "next";
import type { SocialComment } from "@/components/types";
import { supabaseAdmin } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "Missing appId" });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  switch (req.method) {
    case "GET":
      return getComments(appId, req, res);
    case "POST":
      return createComment(appId, req, res);
    default:
      return res.status(405).json({ error: "Method not allowed" });
  }
}

async function getComments(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const parentId = req.query.parent_id as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  // Build query
  let query = supabaseAdmin!.from("miniapp_comments").select("*").eq("app_id", appId);

  // Filter by parent_id
  if (parentId) {
    query = query.eq("parent_id", parseInt(parentId));
  } else {
    query = query.is("parent_id", null);
  }

  // Order by score (upvotes - downvotes), then by date
  query = query
    .order("upvotes", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  const { data: comments, error, count } = await query;

  if (error) {
    console.error("Failed to fetch comments:", error);
    return res.status(500).json({ error: "Failed to fetch comments" });
  }

  // Map to SocialComment format
  const mapped: SocialComment[] = (comments || []).map((c) => ({
    id: c.id.toString(),
    app_id: c.app_id,
    author_user_id: c.wallet_address,
    parent_id: c.parent_id?.toString() || null,
    content: c.content,
    is_developer_reply: c.is_developer_reply,
    upvotes: c.upvotes,
    downvotes: c.downvotes,
    reply_count: c.reply_count,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  return res.status(200).json({
    comments: mapped,
    hasMore: (comments?.length || 0) === limit + 1,
    total: count || mapped.length,
  });
}

async function createComment(appId: string, req: NextApiRequest, res: NextApiResponse) {
  // SECURITY: Verify wallet ownership via cryptographic signature
  const auth = requireWalletAuth(req.headers);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const { content, parent_id } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ error: "Missing content" });
  }

  if (content.length > 2000) {
    return res.status(400).json({ error: "Comment too long" });
  }

  const { data, error } = await supabaseAdmin!
    .from("miniapp_comments")
    .insert({
      app_id: appId,
      wallet_address: auth.address,
      parent_id: parent_id ? parseInt(parent_id) : null,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create comment:", error);
    return res.status(500).json({ error: "Failed to create comment" });
  }

  const comment: SocialComment = {
    id: data.id.toString(),
    app_id: data.app_id,
    author_user_id: data.wallet_address,
    parent_id: data.parent_id?.toString() || null,
    content: data.content,
    is_developer_reply: data.is_developer_reply,
    upvotes: data.upvotes,
    downvotes: data.downvotes,
    reply_count: data.reply_count,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };

  return res.status(201).json({ comment });
}
