-- Unified registry view for host app discovery
-- Sourced from published miniapp submissions

CREATE OR REPLACE VIEW miniapp_registry_view AS
SELECT
    'submission'::text as source_type,
    id,
    app_id,
    manifest,
    manifest_hash,
    cdn_base_url as entry_url,
    COALESCE(
        (assets_selected->>'icon'),
        (build_config->>'icon_url'),
        manifest->>'icon'
    ) as icon_url,
    COALESCE(
        (assets_selected->>'banner'),
        (build_config->>'banner_url'),
        manifest->>'banner'
    ) as banner_url,
    status,
    current_version as version,
    manifest->>'name' as name,
    manifest->>'name_zh' as name_zh,
    manifest->>'description' as description,
    manifest->>'description_zh' as description_zh,
    manifest->>'category' as category,
    updated_at,
    created_at
FROM miniapp_submissions
WHERE status = 'published';

-- Add comment
COMMENT ON VIEW miniapp_registry_view IS 'Published miniapps sourced from submissions for host app discovery';

-- Create index for view materialization if needed
-- CREATE UNIQUE INDEX ON miniapp_registry_view (app_id);
