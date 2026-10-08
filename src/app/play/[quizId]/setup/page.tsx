import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { SetupClient } from "./SetupClient";

export default async function SetupPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/play/${quizId}/setup`);

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id,title,code,host_id,paid,price,revolut_handle,status")
    .eq("id", quizId)
    .maybeSingle();
  if (!quiz) redirect("/join?error=notfound");

  // If user already in a team for this quiz, go straight to play
  const { data: existingMembership } = await supabase
    .from("team_members")
    .select("team_id, teams!inner(quiz_id)")
    .eq("user_id", user.id);
  const existing = existingMembership?.find((m) => {
    const t = m.teams as unknown as { quiz_id: string } | { quiz_id: string }[];
    const quizIdField = Array.isArray(t) ? t[0]?.quiz_id : t?.quiz_id;
    return quizIdField === quizId;
  });
  if (existing) redirect(`/play/${quizId}`);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, emoji")
    .eq("quiz_id", quizId);

  return (
    <div style={{ padding: 24, maxWidth: 540, margin: "0 auto" }}>
      <Link href="/join" className="btn sm ghost" style={{ marginBottom: 8 }}>
        <Icon.back /> Back
      </Link>
      <h1 style={{ fontSize: 32, margin: "8px 0 4px" }}>{quiz.title}</h1>
      <p style={{ color: "var(--muted)", margin: 0 }}>
        {quiz.paid ? `Paid · ${quiz.price ?? ""}` : "Free"} · code{" "}
        <span className="mono">{quiz.code}</span>
      </p>
      <SetupClient quiz={quiz} teams={teams ?? []} userId={user.id} />
    </div>
  );
}
