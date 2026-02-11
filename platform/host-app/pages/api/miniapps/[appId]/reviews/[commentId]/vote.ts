import { createHandler } from "@/lib/api/create-handler";
import { submitVoteBody } from "@/lib/schemas";
import type { z } from "zod";

export default createHandler({
  auth: "wallet",
  rateLimit: "write",
  methods: {
    POST: {
      schema: submitVoteBody,
      handler: async (req, res, ctx) => {
        const commentId = parseInt(req.query.commentId as string, 10);
        if (Number.isNaN(commentId)) {
          return res.status(400).json({ error: "Invalid commentId" });
        }

        const { vote_type } = ctx.parsedInput as z.infer<typeof submitVoteBody>;

        // Check existing vote — toggle if same type
        const { data: existing } = await ctx.db
          .from("comment_votes")
          .select("vote_type")
          .eq("comment_id", commentId)
          .eq("wallet_address", ctx.address!)
          .single();

        if (existing?.vote_type === vote_type) {
          const { error } = await ctx.db
            .from("comment_votes")
            .delete()
            .eq("comment_id", commentId)
            .eq("wallet_address", ctx.address!);

          if (error) return res.status(500).json({ error: "Failed to remove vote" });
          return res.status(200).json({ success: true, action: "removed" });
        }

        // Upsert vote
        const { error } = await ctx.db.from("comment_votes").upsert(
          {
            comment_id: commentId,
            wallet_address: ctx.address!,
            vote_type,
          },
          { onConflict: "comment_id,wallet_address" },
        );

        if (error) return res.status(500).json({ error: "Failed to submit vote" });
        return res.status(200).json({ success: true, action: existing ? "changed" : "added" });
      },
    },

    DELETE: async (req, res, ctx) => {
      const commentId = parseInt(req.query.commentId as string, 10);
      if (Number.isNaN(commentId)) {
        return res.status(400).json({ error: "Invalid commentId" });
      }

      const { error } = await ctx.db
        .from("comment_votes")
        .delete()
        .eq("comment_id", commentId)
        .eq("wallet_address", ctx.address!);

      if (error) return res.status(500).json({ error: "Failed to remove vote" });
      return res.status(200).json({ success: true });
    },
  },
});
