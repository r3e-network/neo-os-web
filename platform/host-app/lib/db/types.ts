// Automation Service Types

import type { ChainId } from "../chains/types";

export type AutomationTaskType = "scheduled" | "conditional" | "subscription";
export type AutomationTaskStatus = "active" | "paused" | "completed" | "failed";

// Generic task action types - miniapps specify what action to perform
export type TaskActionType = "call-api" | "invoke-contract" | "emit-event" | "custom";

// Payload schemas for each action type
export interface CallApiPayload {
  action: "call-api";
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

export interface InvokeContractPayload {
  action: "invoke-contract";
  contractAddress: string;
  method: string;
  args?: unknown[];
  /** Chain ID - required for multi-chain contract invocation */
  chainId: ChainId;
}

export interface EmitEventPayload {
  action: "emit-event";
  eventName: string;
  eventData: Record<string, unknown>;
}

export interface CustomPayload {
  action: "custom";
  handler: string; // Handler key in registry
  data?: Record<string, unknown>;
}

export type TaskPayload = CallApiPayload | InvokeContractPayload | EmitEventPayload | CustomPayload;

export interface AutomationTask {
  id: string;
  app_id: string;
  task_type: AutomationTaskType;
  task_name: string;
  payload: Record<string, unknown>;
  status: AutomationTaskStatus;
  created_at: string;
  updated_at: string;
}

export interface AutomationSchedule {
  id: string;
  task_id: string;
  cron_expression?: string;
  interval_seconds?: number;
  next_run_at?: string;
  last_run_at?: string;
  run_count: number;
  max_runs?: number;
  created_at: string;
}

export interface AutomationLog {
  id: string;
  task_id: string;
  status: string;
  result?: Record<string, unknown>;
  error?: string;
  duration_ms?: number;
  executed_at: string;
}

// API Request/Response types
export interface RegisterTaskRequest {
  appId: string;
  taskName: string;
  taskType: AutomationTaskType;
  payload?: Record<string, unknown>;
  schedule?: {
    cron?: string;
    intervalSeconds?: number;
    maxRuns?: number;
  };
}

export interface RegisterTaskResponse {
  success: boolean;
  taskId?: string;
  error?: string;
}

export interface TaskStatusResponse {
  task: AutomationTask | null;
  schedule: AutomationSchedule | null;
  recentLogs: AutomationLog[];
}
