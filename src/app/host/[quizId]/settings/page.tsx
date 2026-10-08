import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HostSettingsClient } from "./HostSettingsClient";

export default async function HostSettingsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/host/${quizId}/settings`);

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .single();

  if (!quiz) return null;

  return (
    <div style={{ maxWidth: 720 }}>
      <HostSettingsClient quiz={quiz} />
      <div style={{ marginTop: 20 }}>
        <Link href="/settings" className="btn sm">
          Profile / AI provider settings →
        </Link>
      </div>
    </div>
  );
}
