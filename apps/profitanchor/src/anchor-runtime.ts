/**
 * ProfitAnchor and TrustAnchor are two registered modes of the same live
 * PlatformAnchor ABI. Keep the transaction/recovery parser byte-identical so
 * one mode cannot silently gain weaker confirmation semantics than the other.
 */
export * from "../../trustanchor/src/anchor-runtime";
