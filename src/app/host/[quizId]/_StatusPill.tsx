"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QuizStatus } from "@/lib/supabase/types";

const MAP: Record<
  QuizStatus,
  { bg: string; dot: string; label: string; color?: string; pulse?: boolean }
> = {
  draft: { bg: "rgba(255,255,255,0.12)", dot: "#aaa", label: "Draft" },
  open: {
    bg: "var(--sun)",
    dot: "var(--ink)",
    label: "Lobby open",
    color: "var(--ink)",
  },
  running: {
    bg: "var(--mag)",
    dot: "#fff",
    label: "Live",
    color: "#fff",
    pulse: true,
  },
  paused: {
    bg: "var(--lime)",
    dot: "var(--ink)",
    label: "Paused",
    color: "var(--ink)",
  },
  finished: {
    bg: "var(--mint)",
    dot: "var(--ink)",
    label: "Finished",
    color: "var(--ink)",
  },
};

export function StatusPill({
  quizId,
  initial,
}: {
  quizId: string;
  initial: QuizStatus;
}) {
  const [status, setStatus] = useState<QuizStatus>(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`quiz-status-${quizId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "quizzes",
          filter: `id=eq.${quizId}`,
        },
        (payload) => {
          const next = (payload.new as { status?: QuizStatus }).status;
          if (next) setStatus(next);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId]);

  const m = MAP[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: m.bg,
        color: m.color || "var(--paper)",
        padding: "6px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: m.dot,
          animation: m.pulse ? "pulseDot 1s infinite" : "none",
        }}
      />
      {m.label}
      <style jsx>{`
        @keyframes pulseDot {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.4);
          }
        }
      `}</style>
    </span>
  );
}
