/**
 * Shared type for MiniApp editor form state.
 *
 * The form is a flat key-value bag populated by the admin console create/edit
 * UI. Values are strings (text inputs), booleans (checkboxes), arrays
 * (contracts, operations, components), or nested objects (permissions,
 * detail_template). Because every form field is accessed by dynamic string key
 * and bound directly to HTML input `value` / `checked` props, a fully strict
 * Record type would require explicit casts at 100+ call-sites with no
 * additional safety.
 *
 * This branded type centralizes the one unavoidable `any` so the rest of the
 * codebase is `any`-free while keeping form tab components readable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
export type MiniAppFormState = Record<string, any>;
