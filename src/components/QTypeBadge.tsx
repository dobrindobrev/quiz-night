import { Icon } from "./Icon";
import type { QuestionType } from "@/lib/supabase/types";

const MAP: Record<
  QuestionType,
  { icon: (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element; label: string; bg: string; fg?: string }
> = {
  closed: { icon: Icon.check, label: "Multi-choice", bg: "var(--lime)" },
  open: { icon: Icon.type, label: "Open text", bg: "var(--sun)" },
  truefalse: { icon: Icon.tf, label: "True / false", bg: "var(--mint)" },
  music: { icon: Icon.music, label: "Music", bg: "var(--mag)", fg: "#fff" },
  picture: { icon: Icon.image, label: "Picture", bg: "var(--cobalt)", fg: "#fff" },
  video: { icon: Icon.video, label: "Video", bg: "var(--ink)", fg: "#fff" },
};

export function QTypeBadge({ type }: { type: QuestionType }) {
  const m = MAP[type];
  const I = m.icon;
  return (
    <span
      className="chip"
      style={{ background: m.bg, color: m.fg || "var(--ink)", fontWeight: 600 }}
    >
      <I /> {m.label}
    </span>
  );
}
