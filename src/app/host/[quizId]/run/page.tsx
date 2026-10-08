import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RunClient } from "./RunClient";

export default async function RunPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/host/${quizId}/run`);

  const [{ data: quiz }, { data: rounds }, { data: teams }] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", quizId).single(),
    supabase.from("rounds").select("*").eq("quiz_id", quizId).order("position"),
    supabase.from("teams").select("*").eq("quiz_id", quizId).order("score", { ascending: false }),
  ]);
  if (!quiz) return null;

  const roundIds = (rounds ?? []).map((r) => r.id);
  const { data: questions } = roundIds.length
    ? await supabase
        .from("questions")
        .select("*")
        .in("round_id", roundIds)
        .order("position")
    : { data: [] };

  return (
    <RunClient
      quiz={quiz}
      rounds={rounds ?? []}
      questions={questions ?? []}
      initialTeams={teams ?? []}
    />
  );
}
