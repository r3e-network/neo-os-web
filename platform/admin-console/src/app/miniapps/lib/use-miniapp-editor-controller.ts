import { useState, type ChangeEvent } from "react";
import yaml from "js-yaml";
import { miniAppConfigSchema } from "@/lib/schemas";
import type {
  MiniAppMediaAssetKind,
  MiniAppMediaUploadUrlResult,
  MiniAppMediaUploadVariant,
  MediaUploadOptions,
} from "@/lib/hooks/useMiniApps";
import { normalizeMediaUploadVariant, upsertVariantJSON } from "./media-utils";

type CreateMutationLike = {
  mutateAsync: (payload: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
};

type UpdateMutationLike = {
  mutateAsync: (payload: { appId: string; config: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;
};

type MediaUploadMutationLike = {
  mutateAsync: (payload: {
    app_id: string;
    asset_type: MiniAppMediaAssetKind;
    content_type: string;
    file_name: string;
    variant?: MiniAppMediaUploadVariant;
  }) => Promise<MiniAppMediaUploadUrlResult>;
};

type Props = {
  emptyForm: Record<string, any>;
  formToConfig: (form: Record<string, any>) => Record<string, unknown>;
  selectedAppId?: string;
  createMutation: CreateMutationLike;
  updateMutation: UpdateMutationLike;
  mediaUploadMutation: MediaUploadMutationLike;
  onPublishRequested: () => void;
};

export function useMiniAppEditorController({
  emptyForm,
  formToConfig,
  selectedAppId,
  createMutation,
  updateMutation,
  mediaUploadMutation,
  onPublishRequested,
}: Props) {
  const [form, setForm] = useState(emptyForm);
  const [jsonText, setJsonText] = useState("");
  const [formError, setFormError] = useState("");
  const [mediaUploadError, setMediaUploadError] = useState("");
  const [mediaUploadInfo, setMediaUploadInfo] = useState("");

  const resetEditorState = () => {
    setForm(emptyForm);
    setJsonText("");
    setFormError("");
    setMediaUploadError("");
    setMediaUploadInfo("");
  };

  const clearEditorMessages = () => {
    setFormError("");
    setMediaUploadError("");
    setMediaUploadInfo("");
  };

  const handleCreate = async (): Promise<boolean> => {
    setFormError("");
    let payload: Record<string, unknown>;
    try {
      payload = formToConfig(form);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Invalid advanced JSON fields");
      return false;
    }

    const result = miniAppConfigSchema.safeParse(payload);
    if (!result.success) {
      setFormError(result.error.errors[0]?.message || "Validation failed");
      return false;
    }

    try {
      const resultPayload = await createMutation.mutateAsync(payload);
      if (resultPayload?.publish_requested === true) {
        onPublishRequested();
      }
      return true;
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Create failed");
      return false;
    }
  };

  const handleImportJson = async (): Promise<boolean> => {
    setFormError("");
    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonText);
    } catch {
      try {
        parsed = yaml.load(jsonText);
      } catch {
        setFormError("Invalid JSON/YAML");
        return false;
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setFormError("YAML must resolve to an object");
        return false;
      }
    }

    const result = miniAppConfigSchema.safeParse(parsed);
    if (!result.success) {
      setFormError(result.error.errors.map((error) => `${error.path.join(".")}: ${error.message}`).join("; "));
      return false;
    }

    try {
      const resultPayload = await createMutation.mutateAsync(parsed as Record<string, unknown>);
      if (resultPayload?.publish_requested === true) {
        onPublishRequested();
      }
      return true;
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Import failed");
      return false;
    }
  };

  const handleUpdate = async (action: "save_draft" | "publish" = "save_draft"): Promise<boolean> => {
    if (!selectedAppId) {
      setFormError("Missing selected app for update");
      return false;
    }

    setFormError("");
    let payload: Record<string, unknown>;
    try {
      payload = formToConfig(form);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Invalid advanced JSON fields");
      return false;
    }

    const result = miniAppConfigSchema.safeParse(payload);
    if (!result.success) {
      setFormError(result.error.errors[0]?.message || "Validation failed");
      return false;
    }

    try {
      const resultPayload = await updateMutation.mutateAsync({
        appId: selectedAppId,
        config: {
          ...payload,
          action,
        },
      });

      if (resultPayload?.action === "publish_requested") {
        onPublishRequested();
      }

      return true;
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Update failed");
      return false;
    }
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setJsonText(String(reader.result || ""));
    reader.readAsText(file);
  };

  const handleUploadMediaAsset = async (
    assetType: MiniAppMediaAssetKind,
    file: File,
    options: MediaUploadOptions = {},
  ) => {
    setMediaUploadError("");
    setMediaUploadInfo("");

    const appId = String(form.app_id || "").trim().toLowerCase();
    if (!appId) {
      setMediaUploadError("Please fill App ID before uploading media assets.");
      return;
    }

    if (!file.type || !file.type.startsWith("image/")) {
      setMediaUploadError("Only image files are supported.");
      return;
    }

    try {
      const normalizedVariant = assetType === "logo" || assetType === "banner"
        ? normalizeMediaUploadVariant(options.variant)
        : null;
      const applyAsPrimary = options.applyAsPrimary !== false || assetType === "icon";

      const signed = await mediaUploadMutation.mutateAsync({
        app_id: appId,
        asset_type: assetType,
        content_type: file.type,
        file_name: file.name,
        variant: normalizedVariant || undefined,
      });

      const uploadResponse = await fetch(signed.upload_url, {
        method: "PUT",
        headers: {
          ...(signed.headers || {}),
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        const text = await uploadResponse.text();
        throw new Error(text || `Upload failed (${uploadResponse.status})`);
      }

      setForm((prev: Record<string, any>) => ({
        ...prev,
        content_icon_url: assetType === "icon" ? signed.public_url : prev.content_icon_url,
        content_logo_url: assetType === "logo" && applyAsPrimary ? signed.public_url : prev.content_logo_url,
        content_banner_url: assetType === "banner" && applyAsPrimary ? signed.public_url : prev.content_banner_url,
        content_logo_variants_json:
          assetType === "logo" && normalizedVariant
            ? upsertVariantJSON(
                prev.content_logo_variants_json,
                "content_logo_variants_json",
                { url: signed.public_url, ...normalizedVariant },
              )
            : prev.content_logo_variants_json,
        content_banner_variants_json:
          assetType === "banner" && normalizedVariant
            ? upsertVariantJSON(
                prev.content_banner_variants_json,
                "content_banner_variants_json",
                { url: signed.public_url, ...normalizedVariant },
              )
            : prev.content_banner_variants_json,
      }));

      const variantInfo = normalizedVariant ? " Variant entry updated." : "";
      const primaryInfo = applyAsPrimary ? " Primary URL updated." : " Primary URL unchanged.";
      setMediaUploadInfo(`${assetType} uploaded to CDN.${variantInfo}${primaryInfo}`);
    } catch (error) {
      setMediaUploadError(error instanceof Error ? error.message : "Media upload failed");
    }
  };

  return {
    form,
    setForm,
    jsonText,
    setJsonText,
    formError,
    mediaUploadError,
    mediaUploadInfo,
    handleCreate,
    handleImportJson,
    handleUpdate,
    handleFileUpload,
    handleUploadMediaAsset,
    resetEditorState,
    clearEditorMessages,
  };
}
