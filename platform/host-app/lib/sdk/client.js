// Re-export shim: platform/sdk/src is the single source of truth for the
// MiniApp SDK. Never copy SDK implementations into the host app — the
// sdk-cleanliness test rejects anything in lib/sdk that is not a re-export.
export * from "../../../sdk/src/client";
