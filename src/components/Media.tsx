"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export function PicturePlaceholder({
  url,
  compact = false,
}: {
  url?: string | null;
  compact?: boolean;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt="question"
        style={{
          width: "100%",
          aspectRatio: compact ? "16/9" : "4/3",
          borderRadius: 16,
          border: "2px solid var(--ink)",
          objectFit: "cover",
        }}
      />
    );
  }
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: compact ? "16/9" : "4/3",
        borderRadius: 16,
        border: "2px solid var(--ink)",
        overflow: "hidden",
        background:
          "repeating-linear-gradient(45deg, var(--lime) 0 14px, var(--cobalt) 14px 28px)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "8%",
          border: "2px dashed rgba(0,0,0,0.4)",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(250,247,240,0.92)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        [picture placeholder]
      </div>
    </div>
  );
}

export function AudioPlaceholder({ url }: { url?: string | null }) {
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setProg((p) => {
        if (p >= 100) {
          setPlaying(false);
          return 0;
        }
        return p + 1.5;
      });
    }, 60);
    return () => clearInterval(t);
  }, [playing]);
  if (url) {
    return (
      <audio
        controls
        src={url}
        style={{ width: "100%", borderRadius: 12, background: "var(--mag)" }}
      />
    );
  }
  const bars = Array.from({ length: 40 });
  return (
    <div
      style={{
        background: "var(--mag)",
        border: "2px solid var(--ink)",
        borderRadius: 16,
        padding: 18,
        color: "#fff",
        boxShadow: "3px 3px 0 var(--ink)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          className="btn"
          style={{
            width: 54,
            height: 54,
            padding: 0,
            borderRadius: "50%",
            background: "#fff",
            color: "var(--ink)",
          }}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? <Icon.pause /> : <Icon.play />}
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "end",
              gap: 2,
              height: 36,
              marginBottom: 6,
            }}
          >
            {bars.map((_, i) => {
              const active = (i / bars.length) * 100 < prog;
              const h = 8 + (Math.sin(i * 0.7) + 1) * 14;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: h,
                    background: active ? "#fff" : "rgba(255,255,255,0.35)",
                    borderRadius: 2,
                    transition: "background 0.2s",
                  }}
                />
              );
            })}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              opacity: 0.9,
            }}
          >
            <span>Audio clip</span>
            <span>{Math.round(prog * 0.3)}s / 30s</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VideoPlaceholder({ url }: { url?: string | null }) {
  if (url) {
    return (
      <video
        controls
        src={url}
        style={{
          width: "100%",
          aspectRatio: "16/9",
          borderRadius: 16,
          border: "2px solid var(--ink)",
        }}
      />
    );
  }
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "16/9",
        borderRadius: 16,
        border: "2px solid var(--ink)",
        overflow: "hidden",
        background: "linear-gradient(135deg, #0F0F12 0%, #2D4EFF 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.15) 1.5px, transparent 1.5px)",
          backgroundSize: "18px 18px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: "50%",
            background: "var(--lime)",
            border: "2px solid var(--ink)",
            boxShadow: "5px 5px 0 var(--ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink)",
          }}
        >
          <Icon.play />
        </div>
      </div>
    </div>
  );
}
