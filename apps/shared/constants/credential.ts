export const CREDENTIAL_CATEGORIES = {
  EVENT: "Event",
  IDENTITY: "Identity",
  RECOVERY: "Recovery",
} as const;

export const CREDENTIAL_TYPES = {
  ATTENDANCE_BADGE: "attendance_badge",
  IDENTITY_PASSPORT: "identity_passport",
  RECOVERY_AUDIT: "recovery_audit",
} as const;

export const ISSUER_POLICIES = {
  EVENT_ORGANIZER_ATTESTS_CHECKIN: "event_organizer_attests_checkin",
  IDENTITY_ISSUER_ATTESTS_NEODID_RESOLUTION: "identity_issuer_attests_neodid_resolution",
  RECOVERY_OPERATOR_ATTESTS_GUARDIAN_STATE: "recovery_operator_attests_guardian_state",
} as const;

export const CREDENTIAL_REGISTRY = {
  event_attendance: {
    category: CREDENTIAL_CATEGORIES.EVENT,
    credentialType: CREDENTIAL_TYPES.ATTENDANCE_BADGE,
    issuerPolicy: ISSUER_POLICIES.EVENT_ORGANIZER_ATTESTS_CHECKIN,
  },
  identity_passport: {
    category: CREDENTIAL_CATEGORIES.IDENTITY,
    credentialType: CREDENTIAL_TYPES.IDENTITY_PASSPORT,
    issuerPolicy: ISSUER_POLICIES.IDENTITY_ISSUER_ATTESTS_NEODID_RESOLUTION,
  },
  recovery_audit: {
    category: CREDENTIAL_CATEGORIES.RECOVERY,
    credentialType: CREDENTIAL_TYPES.RECOVERY_AUDIT,
    issuerPolicy: ISSUER_POLICIES.RECOVERY_OPERATOR_ATTESTS_GUARDIAN_STATE,
  },
} as const;

export type CredentialCategory =
  (typeof CREDENTIAL_CATEGORIES)[keyof typeof CREDENTIAL_CATEGORIES];

export type CredentialType =
  (typeof CREDENTIAL_TYPES)[keyof typeof CREDENTIAL_TYPES];

export type CredentialIssuerPolicy =
  (typeof ISSUER_POLICIES)[keyof typeof ISSUER_POLICIES];
