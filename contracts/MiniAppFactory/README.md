# MiniAppFactory

`MiniAppFactory` is the on-chain template registry and deployment factory for MiniApps.

## Purpose

- Store multiple MiniApp contract templates (`nef` + `manifest`) by `templateId`.
- Enable template lifecycle management (`upsert`, enable/disable, delete).
- Deploy user MiniApp contracts from a selected template.
- Optionally register newly deployed contracts to `AppRegistry` in the same transaction.

## Core Methods

- `upsertTemplate(templateId, templateType, nefFile, manifest, description, active)`
- `setTemplateStatus(templateId, active)`
- `deleteTemplate(templateId)`
- `getTemplate(templateId)`
- `deployFromTemplate(templateId, initData)`
- `deployAndRegister(templateId, initParams, appId, manifestHash, entryUrl, developerPubKey, name, description, icon, banner, category)`
- `setAppRegistry(appRegistryHash)`

## Admin Controls

- Contract admin can update template catalog and factory config.
- Deployment is permissionless by design so developers can self-serve deployments.
- `deployAndRegisterFromTemplate` requires `AppRegistry` to be configured via `setAppRegistry`.

## Events

- `TemplateUpserted`
- `TemplateStatusChanged`
- `TemplateDeleted`
- `TemplateDeployed`
- `AppRegistryChanged`

These events are intended for off-chain indexers/admin backends to sync template catalog and deployment activity.
