import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayerClient } from "./PlayerClient";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/play/${quizId}`);

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .maybeSingle();
  if (!quiz) redirect("/join?error=notfound");

  // Find the user's team for this quiz
  const { data: myTeams } = await supabase
    .from("team_members")
    .select("team_id, is_captain, teams!inner(*)")
    .eq("user_id", user.id);
  const myMembership = myTeams?.find((m) => {
    const t = m.teams as unknown as { quiz_id: string } | { quiz_id: string }[];
    const quizIdField = Array.isArray(t) ? t[0]?.quiz_id : t?.quiz_id;
    return quizIdField === quizId;
  });
  if (!myMembership) redirect(`/play/${quizId}/setup`);

  const team = Array.isArray(myMembership.teams)
    ? myMembership.teams[0]
    : myMembership.teams;

  // Load rounds + questions
  const { data: rounds } = await supabase
    .from("rounds")
    .select("*")
    .eq("quiz_id", quizId)
    .order("position");
  const roundIds = (rounds ?? []).map((r) => r.id);
  const { data: questions } = roundIds.length
    ? await supabase
        .from("questions")
        .select("*")
        .in("round_id", roundIds)
        .order("position")
    : { data: [] };

  // Team members + all teams for leaderboard
  const { data: members } = await supabase
    .from("team_members")
    .select("*, profiles:profiles!team_members_user_id_fkey(id,display_name,email)")
    .eq("team_id", team.id);
  const { data: allTeams } = await supabase
    .from("teams")
    .select("id,name,emoji,score,approved")
    .eq("quiz_id", quizId);

  return (
    <PlayerClient
      quiz={quiz}
      team={team}
      rounds={rounds ?? []}
      questions={questions ?? []}
      userId={user.id}
      isCaptain={myMembership.is_captain}
      members={
        members?.map((m) => {
          const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          return {
            user_id: m.user_id,
            is_captain: m.is_captain,
            display_name: p?.display_name ?? p?.email ?? "Player",
          };
        }) ?? []
      }
      allTeams={allTeams ?? []}
    />
  );
}
