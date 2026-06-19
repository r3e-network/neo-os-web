import type { ReactNode } from "react";

interface CertificatePreviewProps {
  /** Issuer / organisation name shown along the top of the credential. */
  issuerName: string;
  /** Headline title of the certificate (template name). */
  title: string;
  /** Person the certificate honours. */
  recipientName: string;
  /** What the recipient accomplished. */
  achievement: string;
  /** Label for the soulbound seal ("Soulbound"). */
  sealLabel: string;
  /** Caption under the recipient name ("Awarded to" / "Recipient"). */
  awardedToLabel: string;
  /** Caption above the achievement line. */
  achievementLabel: string;
  /** Fallback shown for the title before a template is chosen. */
  titlePlaceholder: string;
  /** Fallback shown for the recipient before a name is typed. */
  recipientPlaceholder: string;
  /** Fallback shown for the achievement before one is typed. */
  achievementPlaceholder: string;
  /** Fallback issuer line. */
  issuerPlaceholder: string;
  /** Optional status / validity chip(s) rendered in the corner. */
  status?: ReactNode;
  /** Optional footer slot (token id, issue date) rendered along the base. */
  footer?: ReactNode;
  /** Marks a faded "draft" treatment for the live issue preview. */
  draft?: boolean;
}

/**
 * A framed credential artifact that makes the soulbound NEP-11 read as a
 * keepsake rather than a data table. Used both as a live preview while the
 * issuer drafts a certificate and as the verified-result card. Empty fields
 * fall back to friendly placeholders so the frame never collapses.
 */
export default function CertificatePreview({
  issuerName,
  title,
  recipientName,
  achievement,
  sealLabel,
  awardedToLabel,
  achievementLabel,
  titlePlaceholder,
  recipientPlaceholder,
  achievementPlaceholder,
  issuerPlaceholder,
  status,
  footer,
  draft = false,
}: CertificatePreviewProps) {
  return (
    <figure
      className={`certificate-artifact${draft ? " certificate-artifact--draft" : ""}`}
    >
      <div className="certificate-artifact__frame">
        <div className="certificate-artifact__head">
          <span className="certificate-artifact__issuer">
            {issuerName.trim() || issuerPlaceholder}
          </span>
          {status && (
            <span className="certificate-artifact__status">{status}</span>
          )}
        </div>

        <p className="certificate-artifact__title">
          {title.trim() || titlePlaceholder}
        </p>

        <div className="certificate-artifact__body">
          <span className="certificate-artifact__caption">
            {awardedToLabel}
          </span>
          <p className="certificate-artifact__recipient">
            {recipientName.trim() || recipientPlaceholder}
          </p>
          <span className="certificate-artifact__caption">
            {achievementLabel}
          </span>
          <p className="certificate-artifact__achievement">
            {achievement.trim() || achievementPlaceholder}
          </p>
        </div>

        <div className="certificate-artifact__foot">
          <span className="certificate-artifact__seal" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <circle
                cx="24"
                cy="22"
                r="13"
                fill="currentColor"
                fillOpacity="0.14"
              />
              <circle
                cx="24"
                cy="22"
                r="13"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M19 22.5l3.4 3.4L29 19"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path
                d="M19 33l5-2 5 2-2-7h-6l-2 7z"
                fill="currentColor"
                fillOpacity="0.85"
              />
            </svg>
          </span>
          <span className="certificate-artifact__seal-label">{sealLabel}</span>
        </div>
      </div>
      {footer && <figcaption className="certificate-artifact__meta">{footer}</figcaption>}
    </figure>
  );
}
