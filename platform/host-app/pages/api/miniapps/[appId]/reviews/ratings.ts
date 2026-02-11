import type { SocialRating } from "@/components/types";
import { createHandler } from "@/lib/api/create-handler";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import { submitRatingBody } from "@/lib/schemas";
import type { z } from "zod";

export default createHandler({
  auth: "none",
  rateLimit: "api",
  methods: {
    GET: async (req, res, ctx) => {
      const appId = req.query.appId as string;
      if (!appId) return res.status(400).json({ error: "Missing appId" });

      const wallet = req.query.wallet as string | undefined;

      const { data: ratings, error } = await ctx.db
        .from("miniapp_ratings")
        .select("rating_value, review_text, wallet_address")
        .eq("app_id", appId);

      if (error) return res.status(500).json({ error: "Failed to fetch ratings" });

      const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
      let sum = 0;
      for (const r of ratings || []) {
        const key = r.rating_value.toString();
        distribution[key] = (distribution[key] || 0) + 1;
        sum += r.rating_value;
      }

      const total = ratings?.length || 0;
      const avgRating = total > 0 ? sum / total : 0;
      const userRating = wallet ? ratings?.find((r) => r.wallet_address === wallet) : undefined;

      const rating: SocialRating = {
        app_id: appId,
        avg_rating: avgRating,
        weighted_score: avgRating * Math.log10(total + 1),
        total_ratings: total,
        distribution,
        user_rating: userRating
          ? { rating_value: userRating.rating_value, review_text: userRating.review_text }
          : undefined,
      };

      return res.status(200).json({ rating });
    },

    POST: {
      rateLimit: "write",
      schema: submitRatingBody,
      handler: async (req, res, ctx) => {
        const appId = req.query.appId as string;
        if (!appId) return res.status(400).json({ error: "Missing appId" });

        // Manual wallet auth (route is auth: "none" for public GET)
        const auth = requireWalletAuth(req.headers);
        if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

        const { value, review } = ctx.parsedInput as z.infer<typeof submitRatingBody>;

        const { error } = await ctx.db.from("miniapp_ratings").upsert(
          {
            app_id: appId,
            wallet_address: auth.address,
            rating_value: value,
            review_text: review?.slice(0, 1000) || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "app_id,wallet_address" },
        );

        if (error) return res.status(500).json({ error: "Failed to submit rating" });
        return res.status(201).json({ success: true });
      },
    },
  },
});
