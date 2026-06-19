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
  isWalletConnecting?: boolean;
  onConnect?: () => void;
  initialAaContractHash?: string;
  initialAccountIdHash?: string;
  initialPriceGas?: string;
  initialListingTitle?: string;
  initialMetadataUri?: string;
  initialSignature?: string;
  dispatch: (name: string, ...args: unknown[]) => Promise<unknown>;
}

function shortHash(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 18) return trimmed;
  return `${trimmed.slice(0, 10)}…${trimmed.slice(-6)}`;
}

export function CreateListingCard({
  t,
  isSubmitting,
  isMarketReady,
  walletAddress,
  marketHash,
  isWalletConnecting = false,
  onConnect,
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

  const previewTitle = listingTitle.trim() || t("untitledListing");
  const previewPrice = isValidGasPrice ? normalizedPriceGas : "—";
  const previewAccount = accountIdHash.trim()
    ? shortHash(accountIdHash)
    : t("previewAccountPlaceholder");

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
          <div className="create-blocked-hint">
            <p>{t("createListingWalletRequired")}</p>
            {onConnect && (
              <NeoButton
                variant="primary"
                size="sm"
                loading={isWalletConnecting}
                aria-label={t("connectWallet")}
                onClick={onConnect}
              >
                {t("connectWallet")}
              </NeoButton>
            )}
          </div>
        )}

        {/* Live preview of the buyer-facing card so the seller sees exactly what
            they are listing (title, price, AA account) before submitting. */}
        <div className="create-preview" aria-label={t("createPreviewLabel")}>
          <span className="create-preview__eyebrow">
            {t("createPreviewLabel")}
          </span>
          <div className="create-preview__card">
            <span className="create-preview__avatar" aria-hidden="true">
              AA
            </span>
            <div className="create-preview__body">
              <strong className="create-preview__title">{previewTitle}</strong>
              <span className="create-preview__account">{previewAccount}</span>
            </div>
            <div className="create-preview__price">
              <strong>{previewPrice}</strong>
              <span>{t("tokenGas")}</span>
            </div>
          </div>
        </div>

        <NeoInput
          value={priceGas}
          label={t("priceInput")}
          hint={t("priceBoundsHint")}
          suffix={t("tokenGas")}
          placeholder={t("pricePlaceholder")}
          error={
            normalizedPriceGas && !isValidGasPrice ? t("invalidPriceInput") : ""
          }
          onChange={(val) => setPriceGas(val)}
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
          value={listingTitle}
          label={t("titleInput")}
          placeholder={t("titlePlaceholder")}
          onChange={(val) => setListingTitle(val)}
        />

        {/* Advanced/optional inputs are collapsed by default to keep the form
            scannable — most sellers keep the canonical AA core and skip
            metadata. */}
        <details className="create-advanced">
          <summary>{t("createAdvancedSummary")}</summary>
          <div className="create-advanced__body">
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
              value={metadataUri}
              type="textarea"
              label={t("metadataInput")}
              placeholder={t("metadataPlaceholder")}
              onChange={(val) => setMetadataUri(val)}
            />
          </div>
        </details>

        <p className="create-no-fee-note">{t("createNoFeeNote")}</p>
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
