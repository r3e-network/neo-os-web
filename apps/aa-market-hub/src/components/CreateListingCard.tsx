import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";

interface CreateListingCardProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  isSubmitting: boolean;
  canCreateListing: boolean;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export function CreateListingCard({ t, isSubmitting, canCreateListing, dispatch }: CreateListingCardProps) {
  const [aaContractHash, setAaContractHash] = useState("");
  const [accountIdHash, setAccountIdHash] = useState("");
  const [priceGas, setPriceGas] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [metadataUri, setMetadataUri] = useState("");

  const handleCreate = async () => {
    await dispatch("createListing", aaContractHash, accountIdHash, priceGas, listingTitle, metadataUri);
    setAccountIdHash("");
    setPriceGas("");
    setListingTitle("");
    setMetadataUri("");
  };

  return (
    <NeoCard variant="erobo" title={t("createListingTitle")} className="operation-card">
      <div className="stack">
        <NeoInput value={aaContractHash} label={t("aaContractInput")} hint={t("aaContractHint")} placeholder={t("aaContractHashPlaceholder")} onChange={(val) => setAaContractHash(val)} />
        <NeoInput value={accountIdHash} label={t("accountIdInput")} hint={t("accountIdHint")} placeholder={t("accountIdHashPlaceholder")} onChange={(val) => setAccountIdHash(val)} />
        <NeoInput value={priceGas} label={t("priceInput")} placeholder={t("pricePlaceholder")} onChange={(val) => setPriceGas(val)} />
        <NeoInput value={listingTitle} label={t("titleInput")} placeholder={t("titlePlaceholder")} onChange={(val) => setListingTitle(val)} />
        <NeoInput value={metadataUri} type="textarea" label={t("metadataInput")} placeholder={t("metadataPlaceholder")} onChange={(val) => setMetadataUri(val)} />
        <NeoButton variant="primary" loading={isSubmitting} disabled={!canCreateListing} aria-label={t("createListingCta")} onClick={handleCreate}>
          {t("createListingCta")}
        </NeoButton>
      </div>
    </NeoCard>
  );
}
