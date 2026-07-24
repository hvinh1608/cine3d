'use client';

import { QRCodeSVG } from 'qrcode.react';

const QR_LOGO_SRC = '/cine3d-favicon.png';

type BrandedQrCodeProps = {
  value: string;
  size: number;
  title?: string;
  className?: string;
};

/** QR with CINE3D mark in the center. Uses high ECC + excavate so phones can still scan. */
export default function BrandedQrCode({ value, size, title, className }: BrandedQrCodeProps) {
  const logoSize = Math.max(28, Math.round(size * 0.22));

  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="H"
      marginSize={1}
      bgColor="#ffffff"
      fgColor="#09090b"
      title={title}
      className={className}
      imageSettings={{
        src: QR_LOGO_SRC,
        height: logoSize,
        width: logoSize,
        excavate: true,
      }}
    />
  );
}
