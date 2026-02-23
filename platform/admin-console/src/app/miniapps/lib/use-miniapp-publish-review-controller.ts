import { useState } from "react";
import type {
  MiniAppPublishAuditVerifyResult,
  MiniAppPublishReminderResult,
  MiniAppPublishRequest,
} from "@/lib/hooks/useMiniApps";

type ReviewPublishMutationLike = {
  mutateAsync: (payload: {
    requestId: string;
    decision: "approve" | "reject" | "cancel";
    appId?: string;
  }) => Promise<unknown>;
};

type TriggerPublishRemindersMutationLike = {
  mutateAsync: (payload: { dryRun: boolean }) => Promise<MiniAppPublishReminderResult>;
};

type VerifyPublishAuditMutationLike = {
  mutateAsync: (payload: { appId?: string; limit: number }) => Promise<MiniAppPublishAuditVerifyResult>;
};

type Props = {
  reviewPublishRequestMutation: ReviewPublishMutationLike;
  triggerPublishRemindersMutation: TriggerPublishRemindersMutationLike;
  verifyPublishAuditMutation: VerifyPublishAuditMutationLike;
  selectedAppId?: string;
};

export function useMiniAppPublishReviewController({
  reviewPublishRequestMutation,
  triggerPublishRemindersMutation,
  verifyPublishAuditMutation,
  selectedAppId,
}: Props) {
  const [publishReviewError, setPublishReviewError] = useState("");
  const [publishReminderResult, setPublishReminderResult] = useState<MiniAppPublishReminderResult | null>(null);
  const [publishAuditVerifyResult, setPublishAuditVerifyResult] = useState<MiniAppPublishAuditVerifyResult | null>(null);

  const handleReviewPublishRequest = async (
    request: MiniAppPublishRequest,
    decision: "approve" | "reject" | "cancel",
  ) => {
    setPublishReviewError("");
    try {
      await reviewPublishRequestMutation.mutateAsync({
        requestId: request.id,
        decision,
        appId: request.app_id,
      });
    } catch (error) {
      setPublishReviewError(error instanceof Error ? error.message : "Failed to review publish request");
    }
  };

  const handleTriggerPublishReminders = async (dryRun: boolean) => {
    setPublishReviewError("");
    try {
      const result = await triggerPublishRemindersMutation.mutateAsync({ dryRun });
      setPublishReminderResult(result);
    } catch (error) {
      setPublishReviewError(error instanceof Error ? error.message : "Failed to trigger reminders");
    }
  };

  const handleVerifyPublishAudit = async () => {
    setPublishReviewError("");
    try {
      const result = await verifyPublishAuditMutation.mutateAsync({
        appId: selectedAppId,
        limit: 1000,
      });
      setPublishAuditVerifyResult(result);
    } catch (error) {
      setPublishReviewError(error instanceof Error ? error.message : "Failed to verify publish audit chain");
    }
  };

  return {
    publishReviewError,
    publishReminderResult,
    publishAuditVerifyResult,
    handleReviewPublishRequest,
    handleTriggerPublishReminders,
    handleVerifyPublishAudit,
  };
}
