"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "@/components/Icon";

export function RevolutBlock({
  handle,
  price,
  reference,
}: {
  handle: string;
  price: string;
  reference: string;
}) {
  const cleanHandle = handle.replace(/^@/, "");
  const revolutUrl = cleanHandle ? `https://revolut.me/${cleanHandle}` : "";
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!revolutUrl) return;
    QRCode.toDataURL(revolutUrl, {
      width: 180,
      margin: 1,
      color: { dark: "#0F0F12", light: "#FAF7F0" },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [revolutUrl]);

  return (
    <div
      className="card"
      style={{ padding: 18, background: "var(--ink)", color: "var(--paper)" }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          fontWeight: 700,
          opacity: 0.7,
          letterSpacing: "0.1em",
        }}
      >
        Amount
      </div>
      <div className="mono" style={{ fontSize: 38, fontWeight: 700 }}>
        {price}
      </div>
      {qr && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: "var(--paper)",
            borderRadius: 12,
            display: "inline-block",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} width={160} height={160} alt="Revolut QR" />
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          fontWeight: 700,
          opacity: 0.7,
          letterSpacing: "0.1em",
          marginTop: 10,
        }}
      >
        To Revolut handle
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
        }}
      >
        <div className="mono" style={{ fontSize: 20, fontWeight: 700, flex: 1 }}>
          @{cleanHandle}
        </div>
        <button
          className="btn sm lime"
          onClick={() => {
            navigator.clipboard.writeText(`@${cleanHandle}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? (
            <>
              <Icon.check /> Copied
            </>
          ) : (
            "Copy"
          )}
        </button>
      </div>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          fontWeight: 700,
          opacity: 0.7,
          letterSpacing: "0.1em",
          marginTop: 10,
        }}
      >
        Reference
      </div>
      <div className="mono" style={{ fontSize: 14, marginTop: 2 }}>
        {reference}
      </div>
    </div>
  );
}
