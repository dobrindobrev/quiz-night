import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div style={{ padding: 32, maxWidth: 640, margin: "0 auto" }}>
      <Link href="/quizzes" className="btn sm ghost" style={{ marginBottom: 16 }}>
        <Icon.back /> Back
      </Link>
      <h1 style={{ fontSize: 40, margin: "0 0 8px" }}>Settings</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Your AI provider, key, and default payment handle.
      </p>
      <SettingsForm
        initial={{
          api_provider: profile?.api_provider ?? "anthropic",
          api_key: profile?.api_key ?? "",
          revolut_handle: profile?.revolut_handle ?? "",
          display_name: profile?.display_name ?? user.email ?? "",
        }}
      />
    </div>
  );
}
