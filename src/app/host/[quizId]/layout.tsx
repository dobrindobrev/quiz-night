import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { HostTabs } from "./_HostTabs";
import { StatusPill } from "./_StatusPill";

export default async function HostLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/host/${quizId}/builder`);

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id,title,code,status,host_id")
    .eq("id", quizId)
    .maybeSingle();
  if (!quiz) notFound();
  if (quiz.host_id !== user.id) redirect("/quizzes");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "var(--ink)",
          color: "var(--paper)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link href="/quizzes" style={{ textDecoration: "none" }}>
          <Logo inverse />
        </Link>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            background: "var(--lime)",
            color: "var(--ink)",
            padding: "3px 8px",
            borderRadius: 6,
            fontWeight: 700,
          }}
        >
          HOST
        </span>
        <div style={{ color: "var(--paper)", fontWeight: 600 }}>{quiz.title}</div>
        <HostTabs quizId={quiz.id} />
        <div style={{ flex: 1 }} />
        <StatusPill quizId={quiz.id} initial={quiz.status} />
        <Link href="/quizzes" className="btn sm ghost" style={{ color: "var(--paper)" }}>
          Exit
        </Link>
      </header>
      <div
        style={{
          flex: 1,
          padding: "28px 32px",
          maxWidth: 1440,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}
