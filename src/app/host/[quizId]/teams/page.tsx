import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TeamsClient } from "./TeamsClient";

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/host/${quizId}/teams`);

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id,title,code,paid,price,revolut_handle")
    .eq("id", quizId)
    .single();
  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("quiz_id", quizId)
    .order("created_at");

  if (!quiz) return null;

  return <TeamsClient quiz={quiz} initialTeams={teams ?? []} />;
}
