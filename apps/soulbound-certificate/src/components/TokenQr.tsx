import { useEffect, useState } from "react";

interface TokenQrProps {
  /** Value encoded into the QR (the permissionless verification deep link). */
  value: string;
  /** Pixel size of the rendered square QR. */
  size?: number;
  /** Accessible label for the generated image. */
  label: string;
}

/**
 * Dependency-light certificate verification QR.
 *
 * The `qrcode` package is already a declared dependency of this app; it is
 * dynamically imported so the encoder never lands in the initial bundle and is
 * only fetched the first time a certificate is displayed. Rendering targets a
 * PNG data URL drawn into an <img>, matching the repo's existing QR pattern
 * (neo-convert). A failed encode degrades to nothing rather than throwing.
 */
export default function TokenQr({ value, size = 132, label }: TokenQrProps) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let active = true;
    if (!value) {
      setDataUrl("");
      return;
    }
    void (async () => {
      try {
        const { default: QRCode } = await import("qrcode");
        const url = await QRCode.toDataURL(value, {
          margin: 1,
          width: size,
          errorCorrectionLevel: "M",
        });
        if (active) setDataUrl(url);
      } catch {
        if (active) setDataUrl("");
      }
    })();
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) return null;
  return (
    <img
      className="token-qr"
      src={dataUrl}
      width={size}
      height={size}
      alt={label}
    />
  );
}
