"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * QrCode — a styled QR for the projector lobby (and anywhere a join link is
 * shown). Rendered on a high-contrast light plate (QR codes need a light quiet
 * zone to scan reliably) inside a cosmic-tinted frame so it sits coherently on
 * the dark stage without sacrificing scannability.
 *
 * The EY-yellow accent appears only on the surrounding frame, never inside the
 * scannable matrix (colored modules hurt scan reliability).
 */

export interface QrCodeProps {
  /** The URL the QR encodes (e.g. the voter join link). */
  value: string;
  /** Module matrix size in px. */
  size?: number;
  className?: string;
}

export function QrCode({ value, size = 240, className }: QrCodeProps) {
  return (
    <div
      className={[
        "inline-flex rounded-xl p-3",
        "bg-gradient-to-br from-ey-yellow/25 to-power-green/15",
        "shadow-[var(--shadow-e2)]",
        className ?? "",
      ].join(" ")}
    >
      <div className="rounded-lg bg-white p-3">
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          marginSize={0}
          bgColor="#ffffff"
          fgColor="#0B1026"
          title="Scan to vote"
        />
      </div>
    </div>
  );
}

export default QrCode;
