// =============================================================================
// Barrel re-export — preserves backward compatibility for all consumers
// =============================================================================
//
// Domain hooks have been split into focused modules:
//   useMiniAppList.ts       — listing, CRUD
//   useMiniAppVersioning.ts — version history, rollback
//   useMiniAppPublish.ts    — publish workflow, approval, audit
//   useMiniAppBatch.ts      — batch import, media upload
//   useMiniAppTemplates.ts  — template market
// =============================================================================

export { useMiniApps, useMiniApp, useUpdateMiniAppStatus, useCreateMiniApp, useDeleteMiniApp, useUpdateMiniApp } from "./useMiniAppList";

export {
  useMiniAppVersions,
  useRollbackMiniAppVersion,
} from "./useMiniAppVersioning";
export type {
  MiniAppVersionSummary,
  MiniAppVersionListResult,
  MiniAppRollbackResult,
} from "./useMiniAppVersioning";

export {
  useMiniAppPublishRequests,
  useReviewMiniAppPublishRequest,
  useTriggerPublishReminders,
  useVerifyPublishAuditChain,
} from "./useMiniAppPublish";
export type {
  MiniAppPublishRequest,
  MiniAppPublishRequestListResult,
  MiniAppPublishReminderResult,
  MiniAppPublishAuditVerifyResult,
} from "./useMiniAppPublish";

export {
  useImportMiniAppDefinitions,
  useImportMiniAppBatch,
  useRollbackMiniAppBatchImport,
  useCreateMiniAppMediaUploadUrl,
} from "./useMiniAppBatch";
export type {
  MiniAppDefinitionImportResult,
  MiniAppBatchImportDefinitionInput,
  MiniAppBatchImportRollbackTarget,
  MiniAppBatchImportResult,
  MiniAppBatchRollbackResult,
  MiniAppMediaAssetKind,
  MiniAppMediaUploadVariant,
  MediaUploadOptions,
  MiniAppMediaUploadUrlResult,
} from "./useMiniAppBatch";

export {
  useTemplateMarketTemplates,
  useTemplateMarketRequests,
  useUpsertTemplateMarketEntry,
  useReviewTemplateMarketRequest,
} from "./useMiniAppTemplates";
export type {
  TemplateKind,
  TemplateSourceType,
  TemplatePublishRequestStatus,
  TemplateCatalogItem,
  TemplatePublishRequestRow,
  TemplateMarketTemplateListResult,
  TemplateMarketRequestListResult,
} from "./useMiniAppTemplates";
