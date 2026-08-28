"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
  /** Callback con il data URI, utile per riusare il QR dentro la card esportata. */
  onReady?: (dataUrl: string) => void;
}

export function QrCode({ value, size = 160, className, onReady }: QrCodeProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: "#09090b", light: "#ffffff" },
    })
      .then((url) => {
        if (!active) return;
        setSrc(url);
        onReady?.(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [value, size, onReady]);

  if (!src) {
    return (
      <div
        className={cn("animate-pulse rounded-xl bg-surface-2", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="QR"
      width={size}
      height={size}
      className={cn("rounded-xl bg-white p-1", className)}
    />
  );
}
