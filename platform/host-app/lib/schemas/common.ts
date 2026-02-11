import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Neo N3 address: starts with 'N', followed by 33 base58 chars */
export const neoAddress = z.string().regex(/^N[A-Za-z0-9]{33}$/, "Invalid Neo N3 address");

// ---------------------------------------------------------------------------
// Pagination (query params arrive as strings, so we coerce)
// ---------------------------------------------------------------------------

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Common identifiers
// ---------------------------------------------------------------------------

export const appIdParam = z.object({
  appId: z.string().min(1),
});

export const appIdBody = z.object({
  app_id: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Notifications  (POST /api/notifications)
// ---------------------------------------------------------------------------

export const markNotificationsReadBody = z
  .object({
    ids: z.array(z.string()).min(1).optional(),
    all: z.boolean().optional(),
  })
  .refine((d) => d.all || (d.ids && d.ids.length > 0), {
    message: "Provide 'ids' array or set 'all' to true",
  });

// ---------------------------------------------------------------------------
// Preferences  (PUT /api/preferences)
// ---------------------------------------------------------------------------

export const updatePreferencesBody = z.object({
  preferred_categories: z.array(z.string()).optional(),
  notification_settings: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      digest: z.enum(["daily", "weekly", "none"]).optional(),
    })
    .optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  language: z.string().min(2).max(10).optional(),
});

// ---------------------------------------------------------------------------
// Tokens  (POST /api/tokens)
// ---------------------------------------------------------------------------

export const createTokenBody = z.object({
  name: z.string().min(1, "Token name is required"),
  scopes: z.array(z.string()).optional(),
  expiresInDays: z.number().int().positive().optional(),
});

// ---------------------------------------------------------------------------
// Collections  (POST /api/collections)
// ---------------------------------------------------------------------------

export const addCollectionBody = z.object({
  appId: z.string().min(1, "appId is required"),
});

// ---------------------------------------------------------------------------
// Reports  (POST /api/reports)
// ---------------------------------------------------------------------------

export const generateReportBody = z.object({
  report_type: z.string().min(1),
  date_from: z.string().min(1),
  date_to: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Ratings  (POST /api/miniapps/[appId]/reviews/ratings)
// ---------------------------------------------------------------------------

export const submitRatingBody = z.object({
  value: z.number().int().min(1).max(5),
  review: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Comments  (POST /api/miniapps/[appId]/reviews/comments)
// ---------------------------------------------------------------------------

export const createCommentBody = z.object({
  content: z.string().min(1, "Missing content").max(2000, "Comment too long"),
  parent_id: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Developer Apps  (POST /api/developer/apps)
// ---------------------------------------------------------------------------

export const createAppBody = z.object({
  name: z.string().min(1),
  name_zh: z.string().optional(),
  description: z.string().min(1),
  description_zh: z.string().optional(),
  category: z.string().min(1),
  supported_chains: z.array(z.string()).optional(),
  contracts_json: z.record(z.unknown()).optional(),
  contracts: z.unknown().optional(),
});

// ---------------------------------------------------------------------------
// Wishlist  (POST|DELETE /api/user/wishlist)
// ---------------------------------------------------------------------------

export const wishlistBody = appIdBody;

// ---------------------------------------------------------------------------
// Discovery Queue  (POST /api/user/discovery-queue)
// ---------------------------------------------------------------------------

export const discoveryQueueBody = z.object({
  app_id: z.string().min(1, "App ID is required"),
  action: z.string().min(1, "Action is required"),
});

// ---------------------------------------------------------------------------
// Folders  (POST /api/folders)
// ---------------------------------------------------------------------------

export const createFolderBody = z.object({
  name: z.string().min(1, "Folder name is required").max(100),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
});

// ---------------------------------------------------------------------------
// Notification Preferences  (PUT /api/notifications/preferences)
// ---------------------------------------------------------------------------

export const updateNotificationPrefsBody = z.object({
  email: z.string().email().nullable().optional(),
  notify_miniapp_results: z.boolean().optional(),
  notify_balance_changes: z.boolean().optional(),
  notify_chain_alerts: z.boolean().optional(),
  digest_frequency: z.enum(["instant", "hourly", "daily"]).optional(),
});

// ---------------------------------------------------------------------------
// Subscriptions  (POST /api/subscriptions)
// ---------------------------------------------------------------------------

export const createSubscriptionBody = z.object({
  app_id: z.string().min(1),
  plan: z.string().min(1),
});

// ---------------------------------------------------------------------------
// App Versions  (POST /api/developer/apps/[appId]/versions)
// ---------------------------------------------------------------------------

export const createVersionBody = z.object({
  version: z.string().min(1, "Version is required"),
  entry_url: z.string().min(1, "Entry URL is required"),
  release_notes: z.string().optional(),
  supported_chains: z.array(z.string()).optional(),
  contracts: z.record(z.unknown()).optional(),
  build_url: z
    .string()
    .regex(/^https?:\/\//, "Build URL must be http(s)")
    .optional()
    .or(z.literal("")),
});

// ---------------------------------------------------------------------------
// Comment Votes  (POST /api/miniapps/[appId]/reviews/[commentId]/vote)
// ---------------------------------------------------------------------------

export const submitVoteBody = z.object({
  vote_type: z.enum(["upvote", "downvote"]),
});

// ---------------------------------------------------------------------------
// Chat Messages  (POST /api/chat/[appId]/messages)
// ---------------------------------------------------------------------------

export const postChatMessageBody = z.object({
  content: z.string().min(1, "Missing content").max(500, "Message too long"),
});

// ---------------------------------------------------------------------------
// Version Rollback  (POST /api/versions/[appId]/rollback)
// ---------------------------------------------------------------------------

export const rollbackVersionBody = z.object({
  to_version: z.string().min(1, "Target version is required"),
  reason: z.string().optional(),
});
