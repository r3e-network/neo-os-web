import { createHandler } from "@/lib/api/create-handler";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import { postChatMessageBody } from "@/lib/schemas";
import type { z } from "zod";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  type: "text" | "system" | "tip";
  tipAmount?: string;
}

function formatWallet(wallet: string): string {
  if (!wallet || wallet.length < 10) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export default createHandler({
  auth: "none",
  rateLimit: "api",
  methods: {
    GET: async (req, res, ctx) => {
      const appId = req.query.appId as string;
      if (!appId) return res.status(400).json({ error: "Missing appId" });

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const { data: messages, error } = await ctx.db
        .from("chat_messages")
        .select("*")
        .eq("app_id", appId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return res.status(500).json({ error: "Failed to fetch messages" });

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count } = await ctx.db
        .from("chat_participants")
        .select("*", { count: "exact", head: true })
        .eq("app_id", appId)
        .gte("last_seen_at", fiveMinutesAgo);

      const formatted: ChatMessage[] = (messages || []).reverse().map((m: Record<string, unknown>) => ({
        id: String(m.id),
        userId: m.wallet_address as string,
        userName: formatWallet(m.wallet_address as string),
        content: m.content as string,
        timestamp: m.created_at as string,
        type: (m.message_type as ChatMessage["type"]) || "text",
        tipAmount: m.tip_amount as string | undefined,
      }));

      return res.status(200).json({ messages: formatted, participantCount: count || 0 });
    },

    POST: {
      rateLimit: "write",
      schema: postChatMessageBody,
      handler: async (req, res, ctx) => {
        const appId = req.query.appId as string;
        if (!appId) return res.status(400).json({ error: "Missing appId" });

        // Manual wallet auth (route is auth: "none" for public GET)
        const auth = requireWalletAuth(req.headers);
        if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

        const { content } = ctx.parsedInput as z.infer<typeof postChatMessageBody>;

        const { data, error } = await ctx.db
          .from("chat_messages")
          .insert({ app_id: appId, wallet_address: auth.address, content: content.trim() })
          .select()
          .single();

        if (error) return res.status(500).json({ error: "Failed to send message" });

        // Update participant last seen
        await ctx.db
          .from("chat_participants")
          .upsert(
            { app_id: appId, wallet_address: auth.address, last_seen_at: new Date().toISOString() },
            { onConflict: "app_id,wallet_address" },
          );

        const message: ChatMessage = {
          id: data.id.toString(),
          userId: data.wallet_address,
          userName: formatWallet(data.wallet_address),
          content: data.content,
          timestamp: data.created_at,
          type: "text",
        };

        return res.status(201).json({ message });
      },
    },
  },
});
