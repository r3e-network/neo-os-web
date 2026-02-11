/**
 * Notification Preferences API
 * GET: Fetch user preferences
 * PUT: Update user preferences (field-allowlisted via Zod schema)
 */

import { createHandler } from "@/lib/api/create-handler";
import { updateNotificationPrefsBody } from "@/lib/schemas";

export interface NotificationPreferences {
  email: string | null;
  email_verified: boolean;
  notify_miniapp_results: boolean;
  notify_balance_changes: boolean;
  notify_chain_alerts: boolean;
  digest_frequency: "instant" | "hourly" | "daily";
}

export default createHandler({
  auth: "wallet",
  rateLimit: "api",
  methods: {
    GET: async (req, res, ctx) => {
      const { data, error } = await ctx.db
        .from("notification_preferences")
        .select("*")
        .eq("wallet_address", ctx.address!)
        .single();

      if (error && error.code !== "PGRST116") {
        return res.status(500).json({ error: "Failed to fetch preferences" });
      }

      const prefs: NotificationPreferences = data || {
        email: null,
        email_verified: false,
        notify_miniapp_results: true,
        notify_balance_changes: true,
        notify_chain_alerts: false,
        digest_frequency: "instant",
      };

      return res.status(200).json({ preferences: prefs });
    },
    PUT: {
      rateLimit: "write",
      schema: updateNotificationPrefsBody,
      handler: async (req, res, ctx) => {
        const sanitized = ctx.parsedInput as Record<string, unknown>;

        if (Object.keys(sanitized).length === 0) {
          return res.status(400).json({ error: "No valid fields to update" });
        }

        const { error } = await ctx.db.from("notification_preferences").upsert(
          {
            wallet_address: ctx.address!,
            ...sanitized,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "wallet_address" },
        );

        if (error) {
          return res.status(500).json({ error: "Failed to update preferences" });
        }

        return res.status(200).json({ success: true });
      },
    },
  },
});
