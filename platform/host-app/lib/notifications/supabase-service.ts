import { supabase, isSupabaseConfigured } from "../supabase";
import type { NotificationPreferencesRow, NotificationEventRow } from "./db-types";
import type { NotificationPreferences, NotificationEvent, NotificationType } from "./types";

const PREFS_TABLE = "notification_preferences";
const EVENTS_TABLE = "notification_events";

/** Convert DB row to app type */
function toAppType(row: NotificationPreferencesRow): NotificationPreferences {
  return {
    walletAddress: row.wallet_address,
    email: row.email,
    emailVerified: row.email_verified,
    notifyMiniappResults: row.notify_miniapp_results,
    notifyBalanceChanges: row.notify_balance_changes,
    notifyChainAlerts: row.notify_chain_alerts,
    digestFrequency: row.digest_frequency,
  };
}

/** Convert event row to app type */
function toEventType(row: NotificationEventRow): NotificationEvent {
  return {
    id: row.id,
    type: row.type as NotificationType,
    walletAddress: row.wallet_address,
    title: row.title,
    content: row.content,
    metadata: row.metadata,
    createdAt: row.created_at,
    read: row.read,
  };
}

/** Get preferences by wallet */
export async function getPreferences(wallet: string): Promise<NotificationPreferences | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase.from(PREFS_TABLE).select("*").eq("wallet_address", wallet).single();

  if (error || !data) return null;
  return toAppType(data as NotificationPreferencesRow);
}

/** Upsert preferences */
export async function upsertPreferences(prefs: NotificationPreferences): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase.from(PREFS_TABLE).upsert({
    wallet_address: prefs.walletAddress,
    email: prefs.email,
    email_verified: prefs.emailVerified,
    notify_miniapp_results: prefs.notifyMiniappResults,
    notify_balance_changes: prefs.notifyBalanceChanges,
    notify_chain_alerts: prefs.notifyChainAlerts,
    digest_frequency: prefs.digestFrequency,
    updated_at: new Date().toISOString(),
  });

  return !error;
}

/** Bind email to wallet */
export async function bindEmail(wallet: string, email: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase.from(PREFS_TABLE).upsert({
    wallet_address: wallet,
    email: email,
    email_verified: false,
    updated_at: new Date().toISOString(),
  });

  return !error;
}

/** Verify email */
export async function verifyEmail(wallet: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase
    .from(PREFS_TABLE)
    .update({ email_verified: true, updated_at: new Date().toISOString() })
    .eq("wallet_address", wallet);

  return !error;
}

// ============ Notification Events ============

/** Get notification events for wallet */
export async function getEvents(wallet: string, limit = 50, unreadOnly = false): Promise<NotificationEvent[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from(EVENTS_TABLE)
    .select("*")
    .eq("wallet_address", wallet)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("read", false);
  }

  const { data, error } = await query;

  if (error || !data) return [];
  return data.map((row) => toEventType(row as NotificationEventRow));
}

/** Mark event as read */
export async function markAsRead(eventId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase.from(EVENTS_TABLE).update({ read: true }).eq("id", eventId);

  return !error;
}

/** Mark all events as read for wallet */
export async function markAllAsRead(wallet: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase
    .from(EVENTS_TABLE)
    .update({ read: true })
    .eq("wallet_address", wallet)
    .eq("read", false);

  return !error;
}

/** Get unread count for wallet */
export async function getUnreadCount(wallet: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const { count, error } = await supabase
    .from(EVENTS_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("wallet_address", wallet)
    .eq("read", false);

  if (error) return 0;
  return count ?? 0;
}

/** Create notification event */
export async function createEvent(
  wallet: string,
  type: NotificationType,
  title: string,
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .insert({
      wallet_address: wallet,
      type,
      title,
      content,
      metadata,
      read: false,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id;
}
