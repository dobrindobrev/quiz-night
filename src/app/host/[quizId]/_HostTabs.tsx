"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

const TABS = [
  { id: "builder", label: "Builder", Icon: Icon.sparkle },
  { id: "run", label: "Run Live", Icon: Icon.play },
  { id: "teams", label: "Teams & Payments", Icon: Icon.users },
  { id: "settings", label: "Settings", Icon: Icon.settings },
];

export function HostTabs({ quizId }: { quizId: string }) {
  const pathname = usePathname() || "";
  return (
    <nav style={{ display: "flex", gap: 4, marginLeft: 12, flexWrap: "wrap" }}>
      {TABS.map((t) => {
        const active = pathname.endsWith(`/${t.id}`);
        return (
          <Link
            key={t.id}
            href={`/host/${quizId}/${t.id}`}
            style={{
              background: active ? "var(--paper)" : "transparent",
              color: active ? "var(--ink)" : "var(--paper)",
              border: "none",
              padding: "10px 16px",
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <t.Icon /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
