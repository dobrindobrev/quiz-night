import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { generateQuizCode } from "@/lib/codes";
import { Icon } from "@/components/Icon";

async function createQuiz(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = String(formData.get("title") || "Quiz night");
  const paid = formData.get("paid") === "on";
  const price = String(formData.get("price") || "");
  const revolut = String(formData.get("revolut") || "");

  // find unique code
  let code = generateQuizCode();
  for (let i = 0; i < 5; i++) {
    const { data } = await supabase
      .from("quizzes")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!data) break;
    code = generateQuizCode();
  }

  const { data: quiz, error } = await supabase
    .from("quizzes")
    .insert({
      host_id: user.id,
      title,
      code,
      paid,
      price: paid ? price : null,
      revolut_handle: paid ? revolut : null,
    })
    .select()
    .single();
  if (error || !quiz) throw new Error(error?.message ?? "Failed to create");

  // Seed with one empty round to get them started
  await supabase.from("rounds").insert({
    quiz_id: quiz.id,
    title: "Round 1",
    position: 0,
  });

  redirect(`/host/${quiz.id}/builder`);
}

export default async function NewQuizPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/quizzes/new");

  const { data: profile } = await supabase
    .from("profiles")
    .select("revolut_handle")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div style={{ padding: 32, maxWidth: 640, margin: "0 auto" }}>
      <Link href="/quizzes" className="btn sm ghost" style={{ marginBottom: 16 }}>
        <Icon.back /> Back
      </Link>
      <h1 style={{ fontSize: 40, margin: "0 0 8px" }}>New quiz</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Give it a name. You can build the rounds next.
      </p>

      <form action={createQuiz} className="card" style={{ padding: 22, marginTop: 20 }}>
        <label
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 600,
            color: "var(--muted)",
          }}
        >
          Title
        </label>
        <input
          name="title"
          defaultValue="Friday Night @ The Crown"
          className="field"
          style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}
        />

        <div
          style={{
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1.5px solid rgba(0,0,0,0.1)",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              name="paid"
              style={{ width: 18, height: 18 }}
            />
            Paid entry
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: 12,
              marginTop: 12,
            }}
          >
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>
                Price
              </label>
              <input
                name="price"
                placeholder="£5"
                className="field"
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>
                Revolut handle
              </label>
              <input
                name="revolut"
                defaultValue={profile?.revolut_handle ?? ""}
                placeholder="@your-handle"
                className="field"
                style={{ marginTop: 4 }}
              />
            </div>
          </div>
        </div>

        <button className="btn primary lg" style={{ marginTop: 20, width: "100%" }}>
          Create quiz <Icon.arrow />
        </button>
      </form>
    </div>
  );
}
