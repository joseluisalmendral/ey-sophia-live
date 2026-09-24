"use client";

import { memo } from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * QrFrame — the projector QR (encodes the VOTER url): a white quiet-zone plate
 * inside a glass frame with four EY-yellow viewfinder corners ("point your
 * camera here"). The yellow never touches the scannable matrix. `className`
 * sizes the matrix (fluid width); every other dimension is rem-based so it
 * scales with the projector root.
 */
export const QrFrame = memo(function QrFrame({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const corner =
    "absolute h-[clamp(1.75rem,2.5vw,3rem)] w-[clamp(1.75rem,2.5vw,3rem)] border-ey-yellow";
  return (
    <div className="glass relative p-[clamp(0.7rem,1vw,1.25rem)]" style={{ borderRadius: "1.75rem" }}>
      <span aria-hidden className={`${corner} -left-1 -top-1 rounded-tl-[1.15rem] border-l-[0.25rem] border-t-[0.25rem]`} />
      <span aria-hidden className={`${corner} -right-1 -top-1 rounded-tr-[1.15rem] border-r-[0.25rem] border-t-[0.25rem]`} />
      <span aria-hidden className={`${corner} -bottom-1 -left-1 rounded-bl-[1.15rem] border-b-[0.25rem] border-l-[0.25rem]`} />
      <span aria-hidden className={`${corner} -bottom-1 -right-1 rounded-br-[1.15rem] border-b-[0.25rem] border-r-[0.25rem]`} />
      {/* z-1: above the glass noise layer, so the matrix stays pure black/white. */}
      <div className="relative z-[1] rounded-[0.9rem] bg-white p-[clamp(0.6rem,0.9vw,1.1rem)]">
        <QRCodeSVG
          value={value}
          size={400}
          level="M"
          marginSize={0}
          bgColor="#ffffff"
          fgColor="#0B1026"
          title="Escanea para votar"
          className={["block h-auto", className ?? ""].join(" ")}
        />
      </div>
    </div>
  );
});

export default QrFrame;
