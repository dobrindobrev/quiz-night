"use client";
import { useMemo } from "react";

export function Confetti({ burst }: { burst: number | string }) {
  const colors = [
    "var(--lime)",
    "var(--mag)",
    "var(--cobalt)",
    "var(--sun)",
    "var(--mint)",
  ];
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        dur: 2 + Math.random() * 1.6,
        size: 8 + Math.random() * 10,
        rot: Math.random() * 360,
        color: colors[i % colors.length],
        shape: i % 3,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burst]
  );
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9998,
        overflow: "hidden",
      }}
    >
      {pieces.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: -20,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.shape === 1 ? 1.8 : 1),
            background: p.color,
            borderRadius: p.shape === 2 ? "50%" : 2,
            transform: `rotate(${p.rot}deg)`,
            animation: `confettiFall ${p.dur}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(120vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
