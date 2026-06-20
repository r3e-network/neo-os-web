import { Heart } from "lucide-react";

interface MemorialOfferings {
  incense?: number;
  candle?: number;
  flower?: number;
  fruit?: number;
  wine?: number;
  feast?: number;
}

interface TombstoneCardProps {
  memorial: {
    id: number;
    name?: string;
    birthYear?: number;
    deathYear?: number;
    relationship?: string;
    photoHash?: string;
    offerings?: MemorialOfferings;
    [key: string]: unknown;
  };
  onClick: () => void;
  t: (key: string) => string;
}

/** Offering tallies in on-chain order, paired with their i18n label keys. */
const OFFERING_FIELDS: ReadonlyArray<{ key: keyof MemorialOfferings; labelKey: string }> = [
  { key: "incense", labelKey: "incense" },
  { key: "candle", labelKey: "candle" },
  { key: "flower", labelKey: "flower" },
  { key: "fruit", labelKey: "fruit" },
  { key: "wine", labelKey: "wine" },
  { key: "feast", labelKey: "feast" },
];

/**
 * Resolve a photoHash to a renderable image src: an https:// URL is used as-is,
 * a bare/`ipfs://` CID resolves through a public IPFS gateway. Anything else
 * (empty, non-URL hash) returns null so the heart icon stays.
 */
export function resolvePhotoSrc(photoHash?: string): string | null {
  const raw = String(photoHash ?? "").trim();
  if (!raw) return null;
  if (/^https:\/\//i.test(raw)) return raw;
  const cid = raw.replace(/^ipfs:\/\//i, "").replace(/^\/?ipfs\//i, "");
  if (/^[A-Za-z0-9]{46,}$/.test(cid) || /^bafy[A-Za-z0-9]+$/i.test(cid)) {
    return `https://ipfs.io/ipfs/${cid}`;
  }
  return null;
}

export default function TombstoneCard({ memorial, onClick, t }: TombstoneCardProps) {
  const relationship = typeof memorial.relationship === "string" ? memorial.relationship : "";
  const photoSrc = resolvePhotoSrc(memorial.photoHash);
  const offerings = memorial.offerings ?? {};
  const totalOfferings = OFFERING_FIELDS.reduce(
    (sum, field) => sum + (Number(offerings[field.key]) || 0),
    0,
  );
  const paidOfferings = OFFERING_FIELDS.filter((field) => Number(offerings[field.key]) > 0);

  return (
    <button type="button" className="tombstone-card" aria-label={memorial.name ?? ""} onClick={onClick}>
      <span className="tombstone-icon" aria-hidden="true">
        {photoSrc ? (
          <img
            className="tombstone-photo"
            src={photoSrc}
            alt=""
            loading="lazy"
            onError={(event) => {
              // Fallback to the heart glyph when the remote image fails.
              const img = event.currentTarget;
              img.style.display = "none";
              const fallback = img.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = "";
            }}
          />
        ) : null}
        <Heart size={20} strokeWidth={1.9} style={photoSrc ? { display: "none" } : undefined} />
      </span>
      <div className="tombstone-body">
        <span className="name">{memorial.name}</span>
        {memorial.birthYear && memorial.deathYear && <span className="years">{memorial.birthYear}-{memorial.deathYear}</span>}
      </div>
      {relationship && <span className="tombstone-relation">{relationship}</span>}
      {totalOfferings > 0 && (
        <span className="tombstone-offerings" aria-label={t("offeringsReceived")}>
          {paidOfferings.map((field) => (
            <span key={field.key} className="tombstone-offering-tally">
              {t(field.labelKey)} {Number(offerings[field.key])}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
