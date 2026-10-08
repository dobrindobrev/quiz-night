import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";

export default async function QuizzesListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/quizzes");

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div style={{ padding: 32, maxWidth: 1080, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <Logo />
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/settings" className="btn sm">
            <Icon.settings /> Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button className="btn sm ghost">Sign out</button>
          </form>
        </div>
      </header>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 42, margin: 0, lineHeight: 1 }}>Your quizzes</h1>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>
            Build, run, and track your quiz nights.
          </p>
        </div>
        <Link href="/quizzes/new" className="btn primary lg">
          <Icon.plus /> New quiz
        </Link>
      </div>

      {quizzes && quizzes.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {quizzes.map((q) => (
            <Link
              key={q.id}
              href={`/host/${q.id}/builder`}
              className="card"
              style={{
                padding: 20,
                textDecoration: "none",
                color: "var(--ink)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className={`chip ${q.status === "running" ? "mag" : q.status === "open" ? "sun" : q.status === "finished" ? "mint" : ""}`}
                  style={{
                    color: q.status === "running" ? "#fff" : undefined,
                  }}
                >
                  {q.status}
                </span>
                {q.paid && <span className="chip lime">{q.price ?? "paid"}</span>}
              </div>
              <h3 style={{ margin: 0, fontSize: 22 }}>{q.title}</h3>
              <div
                className="mono"
                style={{ fontSize: 12, color: "var(--muted)" }}
              >
                code {q.code}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div
          className="card"
          style={{ padding: 48, textAlign: "center" }}
        >
          <div style={{ fontSize: 48 }}>🎬</div>
          <h2 style={{ margin: "8px 0" }}>No quizzes yet</h2>
          <p style={{ color: "var(--muted)", margin: "0 0 16px" }}>
            Start your first one in under a minute.
          </p>
          <Link href="/quizzes/new" className="btn primary lg">
            <Icon.plus /> Create your first quiz
          </Link>
        </div>
      )}
    </div>
  );
}
