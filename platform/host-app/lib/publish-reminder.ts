import { logger } from "@/lib/logger";
import type { PublishRequestRow } from "@/lib/miniapp-publish-approval";

export type PublishReminderItem = {
  request_id: string;
  app_id: string;
  status: "sla_breach" | "escalated";
  age_minutes: number;
  message: string;
};

export type PublishReminderResult = {
  success: boolean;
  sent: number;
  dry_run: boolean;
  channel: "webhook" | "disabled";
  reminders: PublishReminderItem[];
};

type Timing = {
  ageMinutes: number;
  isSlaBreached: boolean;
  isEscalated: boolean;
};

function buildReminderMessage(item: PublishReminderItem): string {
  return `[MiniApp Publish Reminder] app=${item.app_id} request=${item.request_id} status=${item.status} age=${item.age_minutes}m`;
}

function buildPayload(items: PublishReminderItem[]) {
  return {
    event: "miniapp_publish_reminder",
    generated_at: new Date().toISOString(),
    count: items.length,
    reminders: items,
  };
}

export async function sendPublishReminders(params: {
  requests: Array<PublishRequestRow & { timing?: Timing }>;
  dryRun: boolean;
}): Promise<PublishReminderResult> {
  const webhook = String(process.env.MINIAPP_PUBLISH_REMINDER_WEBHOOK_URL || "").trim();

  const reminders: PublishReminderItem[] = [];
  for (const request of params.requests) {
    if (request.status !== "pending") continue;

    const timing = request.timing;
    if (!timing) continue;

    let status: "sla_breach" | "escalated" | null = null;
    if (timing.isEscalated) status = "escalated";
    else if (timing.isSlaBreached) status = "sla_breach";
    if (!status) continue;

    const item: PublishReminderItem = {
      request_id: request.id,
      app_id: request.app_id,
      status,
      age_minutes: timing.ageMinutes,
      message: "",
    };
    item.message = buildReminderMessage(item);
    reminders.push(item);
  }

  if (!webhook) {
    return {
      success: true,
      sent: 0,
      dry_run: params.dryRun,
      channel: "disabled",
      reminders,
    };
  }

  if (params.dryRun || reminders.length === 0) {
    return {
      success: true,
      sent: 0,
      dry_run: params.dryRun,
      channel: "webhook",
      reminders,
    };
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPayload(reminders)),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.warn("publish reminder webhook returned non-200:", `${response.status} ${text}`);
      return {
        success: false,
        sent: 0,
        dry_run: params.dryRun,
        channel: "webhook",
        reminders,
      };
    }

    return {
      success: true,
      sent: reminders.length,
      dry_run: params.dryRun,
      channel: "webhook",
      reminders,
    };
  } catch (error) {
    logger.warn("publish reminder webhook request failed:", error);
    return {
      success: false,
      sent: 0,
      dry_run: params.dryRun,
      channel: "webhook",
      reminders,
    };
  }
}
