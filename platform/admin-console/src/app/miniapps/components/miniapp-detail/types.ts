import type { MiniAppPublishRequest, MiniAppVersionSummary } from "@/lib/hooks/useMiniApps";

export type PublishRequestStatus = "all" | "pending" | "approved" | "rejected" | "applied" | "cancelled";
export type VersionChannel = "all" | "draft" | "published";
export type DiffScope = "all" | "manifest" | "operations" | "layout" | "admin";

export type DiffSummary = {
  total: number;
  added: number;
  removed: number;
  changed: number;
};

export type VersionsQueryLike = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  data?: {
    versions: MiniAppVersionSummary[];
  };
};

export type PublishRequestsSla = {
  minutes: number;
  escalation_minutes: number;
  pending: number;
  sla_breached: number;
  escalated: number;
};

export type PublishRequestsQueryLike = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  data?: {
    requests: MiniAppPublishRequest[];
    sla?: PublishRequestsSla;
  };
};
