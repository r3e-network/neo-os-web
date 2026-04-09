interface VaultConfirmationProps { t: (key: string) => string; createdVaultId: string | number | null; }

export default function VaultConfirmation({ t, createdVaultId }: VaultConfirmationProps) {
  if (!createdVaultId) return null;
  return (
    <div className="vault-created">
      <span className="vault-created-label">{t("vaultCreated")}</span>
      <span className="vault-created-id">#{createdVaultId}</span>
    </div>
  );
}
