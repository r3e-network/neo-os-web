import { useEffect, useState, type ChangeEvent } from "react";
import { ImagePlus, RotateCcw } from "lucide-react";
import { FactoryPlayArea } from "@shared/factory/FactoryPlayArea";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import {
  NFT_FACTORY_APP_ID,
  NFT_FACTORY_SUPPORTED_NETWORKS,
  withNftFactoryLaunchDefaults,
} from "./NftFactorySetup";

import "./nft-factory.scss";

const DEFAULT_ARTWORK = "./nft-drop-preview.webp";
const MAX_LOCAL_ARTWORK_BYTES = 10 * 1024 * 1024;
const SUPPORTED_ARTWORK_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function renderableMetadataArtwork(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}

/**
 * NFT Factory keeps the audited shared factory engine, but owns its product
 * identity here.  The local shell lets this app feel like a collection
 * atelier while the app-owned setup adds the NFT-specific ABI gate that the
 * generic factory runtime cannot currently express.
 */
export function NftFactoryPlayArea(props: PlayAreaProps) {
  const { str } = useStateBindings(props.state);
  const [localArtworkUrl, setLocalArtworkUrl] = useState("");
  const [localArtworkName, setLocalArtworkName] = useState("");
  const [artworkError, setArtworkError] = useState("");
  const metadataStatus = str("metadataStatus", "not-checked");
  const metadataDetailKey = str("metadataDetailKey", "metadataNotChecked");
  const metadataSampleName = str("metadataSampleName");
  const metadataSampleImage = str("metadataSampleImage");
  const verifiedArtworkUrl =
    metadataStatus === "verified"
      ? renderableMetadataArtwork(metadataSampleImage)
      : "";
  const activeArtworkUrl =
    localArtworkUrl || verifiedArtworkUrl || DEFAULT_ARTWORK;

  useEffect(
    () => () => {
      if (localArtworkUrl) URL.revokeObjectURL(localArtworkUrl);
    },
    [localArtworkUrl],
  );

  const chooseArtwork = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (
      !SUPPORTED_ARTWORK_TYPES.has(file.type) ||
      file.size <= 0 ||
      file.size > MAX_LOCAL_ARTWORK_BYTES
    ) {
      setArtworkError(props.t("artworkFileInvalid"));
      return;
    }
    setArtworkError("");
    setLocalArtworkName(file.name);
    setLocalArtworkUrl(URL.createObjectURL(file));
  };

  const resetArtwork = () => {
    setArtworkError("");
    setLocalArtworkName("");
    setLocalArtworkUrl("");
  };

  return (
    <section
      className="nft-factory-app"
      aria-label={props.t("collectionStudioLabel")}
    >
      <header className="nft-factory-release-scope">
        <div className="nft-factory-release-scope__lead">
          <h2>{props.t("title")}</h2>
          <p>{props.t("releaseScopeHint")}</p>
        </div>
        <dl className="nft-factory-release-scope__facts">
          <div>
            <dt>{props.t("releaseIncludedLabel")}</dt>
            <dd>{props.t("releaseIncludedValue")}</dd>
          </div>
          <div data-tone={metadataStatus}>
            <dt>{props.t("metadataBoundaryLabel")}</dt>
            <dd className="nft-factory-release-scope__status">
              <span>
                <i aria-hidden="true" />
                {props.t(metadataDetailKey)}
              </span>
              {metadataSampleName ? <small>{metadataSampleName}</small> : null}
            </dd>
          </div>
          <div className="nft-factory-release-scope__artwork">
            <dt>{props.t("artworkPreviewLabel")}</dt>
            <dd>
              <span className="nft-factory-release-scope__art-actions">
                <label>
                  <ImagePlus size={15} aria-hidden="true" />
                  <span>{props.t("chooseArtwork")}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    onChange={chooseArtwork}
                  />
                </label>
                {localArtworkUrl ? (
                  <button
                    type="button"
                    onClick={resetArtwork}
                    aria-label={props.t("resetArtwork")}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </span>
              <small>
                {localArtworkName || props.t("artworkPreviewLocalOnly")}
              </small>
              {artworkError ? <em role="alert">{artworkError}</em> : null}
            </dd>
          </div>
        </dl>
      </header>
      <FactoryPlayArea
        {...props}
        launchContext={withNftFactoryLaunchDefaults(props.launchContext)}
        fixedKind="nep11"
        appId={NFT_FACTORY_APP_ID}
        supportedNetworks={NFT_FACTORY_SUPPORTED_NETWORKS}
        nep11ArtworkUrl={activeArtworkUrl}
        showExecuteAction={false}
        preventRepeatSigning
        requireVerifiedMetadataForSigning
      />
    </section>
  );
}
