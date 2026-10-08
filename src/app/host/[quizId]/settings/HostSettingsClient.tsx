"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import type { Quiz } from "@/lib/supabase/types";

export function HostSettingsClient({ quiz: initialQuiz }: { quiz: Quiz }) {
  const supabase = createClient();
  const toast = useToast();
  const router = useRouter();
  const [quiz, setQuiz] = useState(initialQuiz);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("quizzes")
      .update({
        title: quiz.title,
        paid: quiz.paid,
        price: quiz.price,
        revolut_handle: quiz.revolut_handle,
        question_duration_secs: quiz.question_duration_secs,
      })
      .eq("id", quiz.id);
    setSaving(false);
    if (error) toast(error.message, "error");
    else toast("Saved", "success");
  };

  const resetScores = async () => {
    if (!confirm("Reset all team scores and submissions? Cannot be undone.")) return;
    const { error: e1 } = await supabase
      .from("submissions")
      .delete()
      .in(
        "team_id",
        (
          await supabase.from("teams").select("id").eq("quiz_id", quiz.id)
        ).data?.map((t) => t.id) ?? []
      );
    const { error: e2 } = await supabase
      .from("teams")
      .update({ score: 0 })
      .eq("quiz_id", quiz.id);
    if (e1 || e2) toast((e1 || e2)!.message, "error");
    else toast("Scores reset", "success");
  };

  const deleteQuiz = async () => {
    if (!confirm(`Delete "${quiz.title}"? All rounds, teams and submissions go with it.`))
      return;
    setDeleting(true);
    const { error } = await supabase.from("quizzes").delete().eq("id", quiz.id);
    setDeleting(false);
    if (error) return toast(error.message, "error");
    router.push("/quizzes");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 6px" }}>Quiz</h3>
        <label style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 600 }}>
          Title
        </label>
        <input
          className="field"
          value={quiz.title}
          onChange={(e) => setQuiz((q) => ({ ...q, title: e.target.value }))}
          style={{ marginTop: 6, marginBottom: 14 }}
        />
        <label style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 600 }}>
          Per-question timer (seconds)
        </label>
        <input
          className="field"
          type="number"
          value={quiz.question_duration_secs}
          min={5}
          max={300}
          onChange={(e) =>
            setQuiz((q) => ({
              ...q,
              question_duration_secs: Number(e.target.value),
            }))
          }
          style={{ marginTop: 6 }}
        />
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 6px" }}>Payment</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={quiz.paid}
            onChange={(e) => setQuiz((q) => ({ ...q, paid: e.target.checked }))}
            style={{ width: 18, height: 18 }}
          />
          Paid quiz
        </label>
        {quiz.paid && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: 12,
              marginTop: 12,
            }}
          >
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Price</label>
              <input
                className="field"
                value={quiz.price ?? ""}
                placeholder="£5"
                onChange={(e) => setQuiz((q) => ({ ...q, price: e.target.value }))}
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>
                Revolut handle (overrides profile default)
              </label>
              <input
                className="field"
                value={quiz.revolut_handle ?? ""}
                placeholder="@your-handle"
                onChange={(e) =>
                  setQuiz((q) => ({ ...q, revolut_handle: e.target.value }))
                }
                style={{ marginTop: 4 }}
              />
            </div>
          </div>
        )}
      </div>

      <button
        className="btn primary lg"
        onClick={save}
        disabled={saving}
        style={{ alignSelf: "flex-end" }}
      >
        {saving ? "Saving…" : "Save quiz settings"}
      </button>

      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 6px" }}>Danger zone</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>
          Reset team scores or delete the whole quiz.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={resetScores}>
            <Icon.trash /> Reset scores
          </button>
          <button
            className="btn"
            onClick={deleteQuiz}
            disabled={deleting}
            style={{ background: "var(--mag)", color: "#fff" }}
          >
            <Icon.trash /> {deleting ? "Deleting…" : "Delete quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}
