import { useEffect, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import {
  isHash160OrNeoAddress,
  isMarketPriceGas,
} from "../utils/validation";

interface CreateListingCardProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  isSubmitting: boolean;
  isMarketReady: boolean;
  walletAddress: string;
  marketHash: string;
  initialAaContractHash?: string;
  initialAccountIdHash?: string;
  initialPriceGas?: string;
  initialListingTitle?: string;
  initialMetadataUri?: string;
  initialSignature?: string;
  dispatch: (name: string, ...args: unknown[]) => Promise<unknown>;
}

export function CreateListingCard({
  t,
  isSubmitting,
  isMarketReady,
  walletAddress,
  marketHash,
  initialAaContractHash = "",
  initialAccountIdHash = "",
  initialPriceGas = "",
  initialListingTitle = "",
  initialMetadataUri = "",
  initialSignature = "",
  dispatch,
}: CreateListingCardProps) {
  const [aaContractHash, setAaContractHash] = useState(initialAaContractHash);
  const [accountIdHash, setAccountIdHash] = useState(initialAccountIdHash);
  const [priceGas, setPriceGas] = useState(initialPriceGas);
  const [listingTitle, setListingTitle] = useState(initialListingTitle);
  const [metadataUri, setMetadataUri] = useState(initialMetadataUri);
  const normalizedPriceGas = priceGas.trim();
  // Use the canonical parser/bounds check (utils/validation) instead of an
  // ad-hoc magnitude expression. Enforces the intended 0.01–1000 GAS band.
  const isValidGasPrice = isMarketPriceGas(normalizedPriceGas);
  const isValidAaContract = isHash160OrNeoAddress(aaContractHash);
  const isValidAccountId = isHash160OrNeoAddress(accountIdHash);
  const canSubmit =
    isMarketReady &&
    Boolean(walletAddress.trim()) &&
    isValidAaContract &&
    isValidAccountId &&
    isValidGasPrice;

  useEffect(() => {
    setAaContractHash(initialAaContractHash);
    setAccountIdHash(initialAccountIdHash);
    setPriceGas(initialPriceGas);
    setListingTitle(initialListingTitle);
    setMetadataUri(initialMetadataUri);
  }, [
    initialAaContractHash,
    initialAccountIdHash,
    initialPriceGas,
    initialListingTitle,
    initialMetadataUri,
    initialSignature,
  ]);

  const handleCreate = async () => {
    const result = await dispatch(
      "createListing",
      marketHash,
      aaContractHash,
      accountIdHash,
      priceGas,
      listingTitle,
      metadataUri,
    );
    if (!result) return;
    setAccountIdHash("");
    setPriceGas("");
    setListingTitle("");
    setMetadataUri("");
  };

  return (
    <NeoCard
      variant="erobo"
      title={t("createListingTitle")}
      className="operation-card"
    >
      <div className="stack">
        {!isMarketReady && (
          <p className="hint-text">{t("createListingMarketRequired")}</p>
        )}
        {isMarketReady && !walletAddress.trim() && (
          <p className="hint-text">{t("createListingWalletRequired")}</p>
        )}
        <NeoInput
          value={aaContractHash}
          label={t("aaContractInput")}
          hint={t("aaContractHint")}
          placeholder={t("aaContractHashPlaceholder")}
          error={
            aaContractHash.trim() && !isValidAaContract
              ? t("invalidHashInput")
              : ""
          }
          onChange={(val) => setAaContractHash(val)}
        />
        <NeoInput
          value={accountIdHash}
          label={t("accountIdInput")}
          hint={t("accountIdHint")}
          placeholder={t("accountIdHashPlaceholder")}
          error={
            accountIdHash.trim() && !isValidAccountId
              ? t("invalidHashInput")
              : ""
          }
          onChange={(val) => setAccountIdHash(val)}
        />
        <NeoInput
          value={priceGas}
          label={t("priceInput")}
          placeholder={t("pricePlaceholder")}
          error={
            normalizedPriceGas && !isValidGasPrice ? t("invalidPriceInput") : ""
          }
          onChange={(val) => setPriceGas(val)}
        />
        <NeoInput
          value={listingTitle}
          label={t("titleInput")}
          placeholder={t("titlePlaceholder")}
          onChange={(val) => setListingTitle(val)}
        />
        <NeoInput
          value={metadataUri}
          type="textarea"
          label={t("metadataInput")}
          placeholder={t("metadataPlaceholder")}
          onChange={(val) => setMetadataUri(val)}
        />
        <NeoButton
          variant="primary"
          loading={isSubmitting}
          disabled={!canSubmit}
          aria-label={t("createListingCta")}
          onClick={handleCreate}
        >
          {t("createListingCta")}
        </NeoButton>
      </div>
    </NeoCard>
  );
}
