import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuilderClient } from "./BuilderClient";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/host/${quizId}/builder`);

  const [{ data: quiz }, { data: rounds }, { data: profile }] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", quizId).single(),
    supabase
      .from("rounds")
      .select("*")
      .eq("quiz_id", quizId)
      .order("position"),
    supabase
      .from("profiles")
      .select("api_provider,api_key,revolut_handle")
      .eq("id", user.id)
      .single(),
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
    <BuilderClient
      quiz={quiz}
      rounds={rounds ?? []}
      questions={questions ?? []}
      hasApiKey={!!profile?.api_key}
      provider={profile?.api_provider ?? "anthropic"}
    />
  );
}
