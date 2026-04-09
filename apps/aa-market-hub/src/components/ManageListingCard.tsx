import { useState, useEffect } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import type { MarketListing } from "../utils/aa-market";
import "./ManageListingCard.scss";

interface ManageListingCardProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  selectedListing: MarketListing | null;
  isSubmitting: boolean;
  canManage: boolean;
  canBuy: boolean;
  hasPendingRefund: boolean;
  walletAddress: string;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export function ManageListingCard({ t, selectedListing, isSubmitting, canManage, canBuy, hasPendingRefund, walletAddress, dispatch }: ManageListingCardProps) {
  const [nextPriceGas, setNextPriceGas] = useState("");
  const [newBackupOwner, setNewBackupOwner] = useState("");

  useEffect(() => {
    if (selectedListing) {
      setNextPriceGas(selectedListing.priceGas);
      setNewBackupOwner(walletAddress);
    }
  }, [selectedListing, walletAddress]);

  return (
    <NeoCard variant="erobo" title={t("manageListingTitle")} className="operation-card">
      {selectedListing ? (
        <div className="stack">
          <div className="selection-summary">
            <div className="selection-summary__title">{selectedListing.title || t("untitledListing")}</div>
            <div className="selection-summary__meta">
              <span>#{selectedListing.id}</span>
              <span>{selectedListing.priceGas} {t("tokenGas")}</span>
              <span>{selectedListing.status}</span>
            </div>
          </div>

          <NeoInput
            value={nextPriceGas}
            label={t("newPriceInput")}
            hint={t("newPriceHint")}
            placeholder={t("newPricePlaceholder")}
            disabled={!canManage}
            onChange={(val) => setNextPriceGas(val)}
          />

          {canManage && (
            <NeoButton variant="primary" loading={isSubmitting} disabled={!nextPriceGas.trim()} aria-label={t("updatePriceCta")} onClick={() => dispatch("updatePrice", nextPriceGas)}>
              {t("updatePriceCta")}
            </NeoButton>
          )}

          {canManage && (
            <NeoButton variant="secondary" loading={isSubmitting} aria-label={t("cancelListingCta")} onClick={() => dispatch("cancelSelected")}>
              {t("cancelListingCta")}
            </NeoButton>
          )}

          {canBuy && (
            <NeoInput
              value={newBackupOwner}
              label={t("newBackupOwnerInput")}
              hint={t("newBackupOwnerHint")}
              placeholder={t("newBackupOwnerPlaceholder")}
              onChange={(val) => setNewBackupOwner(val)}
            />
          )}

          {canBuy && (
            <NeoButton variant="primary" loading={isSubmitting} aria-label={t("buyListingCta")} onClick={() => dispatch("buySelected", newBackupOwner)}>
              {t("buyListingCta")}
            </NeoButton>
          )}

          {hasPendingRefund && (
            <NeoButton variant="secondary" loading={isSubmitting} aria-label={t("refundPendingCta")} onClick={() => dispatch("refundSelected")}>
              {t("refundPendingCta")}
            </NeoButton>
          )}
        </div>
      ) : (
        <p className="hint-text">
          {t("selectListingHint")}
        </p>
      )}
    </NeoCard>
  );
}
