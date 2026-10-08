import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";

async function lookupCode(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/join");
  }
  const code = String(formData.get("code") || "").toUpperCase();
  if (!code) redirect("/join?error=empty");
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (!quiz) redirect("/join?error=notfound");
  redirect(`/play/${quiz.id}/setup`);
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const err =
    params.error === "notfound"
      ? "No quiz with that code."
      : params.error === "empty"
      ? "Enter a code."
      : null;
  return (
    <div
      className="dotted"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="card" style={{ padding: 32, width: "100%", maxWidth: 440 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <Logo />
        </Link>
        <h1 style={{ fontSize: 40, margin: "16px 0 8px", lineHeight: 1.05 }}>
          Join a quiz
        </h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Enter the code from your host. We&apos;ll send you a magic link if
          you&apos;re not signed in.
        </p>
        <form
          action={lookupCode}
          style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}
        >
          <label
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Quiz code
          </label>
          <input
            className="field mono"
            name="code"
            placeholder="CROWN-847"
            required
            autoComplete="off"
            style={{
              textAlign: "center",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          />
          <button className="btn primary lg">
            Find quiz <Icon.arrow />
          </button>
          {err && (
            <div
              style={{
                padding: 10,
                background: "var(--mag)",
                color: "#fff",
                border: "2px solid var(--ink)",
                borderRadius: 12,
                fontSize: 13,
              }}
            >
              {err}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
