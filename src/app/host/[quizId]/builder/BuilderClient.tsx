"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { QTypeBadge } from "@/components/QTypeBadge";
import { PicturePlaceholder, AudioPlaceholder, VideoPlaceholder } from "@/components/Media";
import type {
  Quiz,
  Round,
  Question,
  QuestionType,
} from "@/lib/supabase/types";

const QTYPES: QuestionType[] = ["closed", "open", "truefalse", "music", "picture", "video"];

export function BuilderClient({
  quiz: initialQuiz,
  rounds: initialRounds,
  questions: initialQuestions,
  hasApiKey,
  provider,
}: {
  quiz: Quiz;
  rounds: Round[];
  questions: Question[];
  hasApiKey: boolean;
  provider: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [quiz, setQuiz] = useState(initialQuiz);
  const [rounds, setRounds] = useState(initialRounds);
  const [questions, setQuestions] = useState(initialQuestions);
  const [selRound, setSelRound] = useState<string | null>(
    initialRounds[0]?.id ?? null
  );
  const [selQ, setSelQ] = useState<string | null>(
    initialQuestions.find((q) => q.round_id === initialRounds[0]?.id)?.id ?? null
  );

  // Realtime subscriptions
  useEffect(() => {
    const ch = supabase
      .channel(`builder-${quiz.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `quiz_id=eq.${quiz.id}` },
        async () => {
          const { data } = await supabase
            .from("rounds")
            .select("*")
            .eq("quiz_id", quiz.id)
            .order("position");
          if (data) setRounds(data);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quizzes", filter: `id=eq.${quiz.id}` },
        (payload) => setQuiz((q) => ({ ...q, ...(payload.new as Quiz) }))
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [quiz.id, supabase]);

  useEffect(() => {
    const roundIds = rounds.map((r) => r.id);
    if (!roundIds.length) return;
    const ch = supabase
      .channel(`builder-q-${quiz.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "questions" },
        async () => {
          const { data } = await supabase
            .from("questions")
            .select("*")
            .in("round_id", roundIds)
            .order("position");
          if (data) setQuestions(data);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [rounds, supabase, quiz.id]);

  const currentRound = rounds.find((r) => r.id === selRound);
  const roundQuestions = questions.filter((q) => q.round_id === selRound);
  const currentQuestion = roundQuestions.find((q) => q.id === selQ);

  const updateQuiz = async (patch: Partial<Quiz>) => {
    setQuiz((q) => ({ ...q, ...patch }));
    const { error } = await supabase
      .from("quizzes")
      .update(patch)
      .eq("id", quiz.id);
    if (error) toast(error.message, "error");
  };

  const addRound = async () => {
    const { data, error } = await supabase
      .from("rounds")
      .insert({
        quiz_id: quiz.id,
        title: `Round ${rounds.length + 1}`,
        position: rounds.length,
      })
      .select()
      .single();
    if (error) {
      console.error("addRound failed", error);
      return toast(error.message, "error");
    }
    if (data) {
      const r = data as Round;
      setRounds((rs) => (rs.some((x) => x.id === r.id) ? rs : [...rs, r]));
      setSelRound(r.id);
      setSelQ(null);
    }
  };

  const addQuestion = async (roundId: string) => {
    const posCount = questions.filter((q) => q.round_id === roundId).length;
    const { data, error } = await supabase
      .from("questions")
      .insert({
        round_id: roundId,
        type: "open",
        prompt: "New question",
        answer_text: "",
        points: 1,
        position: posCount,
      })
      .select()
      .single();
    if (error) {
      console.error("addQuestion failed", error);
      return toast(error.message, "error");
    }
    if (data) {
      const q = data as Question;
      // Optimistic insert so the UI updates immediately even if realtime is
      // delayed; the realtime subscription de-dupes by id.
      setQuestions((qs) => (qs.some((x) => x.id === q.id) ? qs : [...qs, q]));
      setSelRound(roundId);
      setSelQ(q.id);
    }
  };

  const updateQuestion = async (id: string, patch: Partial<Question>) => {
    setQuestions((qs) =>
      qs.map((q) => (q.id === id ? { ...q, ...patch } : q))
    );
    const { error } = await supabase.from("questions").update(patch).eq("id", id);
    if (error) toast(error.message, "error");
  };

  const deleteQuestion = async (id: string) => {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) toast(error.message, "error");
  };

  const openLobby = async () => {
    await updateQuiz({ status: "open" });
    toast("Lobby is open — share the code!", "success");
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr 360px",
        gap: 20,
        alignItems: "start",
      }}
    >
      {/* Left column: rounds */}
      <div className="card" style={{ padding: 18, position: "sticky", top: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>Rounds</h3>
          <button className="btn sm lime" onClick={addRound}>
            <Icon.plus /> Round
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rounds.map((r) => {
            const rQs = questions.filter((q) => q.round_id === r.id);
            return (
              <div
                key={r.id}
                style={{
                  border: "2px solid var(--ink)",
                  borderRadius: 16,
                  background: selRound === r.id ? "var(--lime)" : "var(--card)",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => {
                    setSelRound(r.id);
                    setSelQ(rQs[0]?.id ?? null);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "transparent",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: "left",
                  }}
                >
                  <span>{r.title}</span>
                  <span className="mono" style={{ fontSize: 11, opacity: 0.6 }}>
                    {rQs.length}q
                  </span>
                </button>
                {selRound === r.id && (
                  <div
                    style={{
                      background: "var(--paper)",
                      borderTop: "2px solid var(--ink)",
                      padding: 8,
                    }}
                  >
                    {rQs.map((q, qi) => (
                      <button
                        key={q.id}
                        onClick={() => setSelQ(q.id)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 10px",
                          border: "none",
                          background:
                            selQ === q.id ? "var(--ink)" : "transparent",
                          color:
                            selQ === q.id ? "var(--paper)" : "var(--ink)",
                          borderRadius: 10,
                          marginBottom: 2,
                          fontSize: 12,
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <span
                          className="mono"
                          style={{ fontSize: 10, opacity: 0.6 }}
                        >
                          {(qi + 1).toString().padStart(2, "0")}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {q.prompt}
                        </span>
                      </button>
                    ))}
                    <button
                      className="btn sm"
                      style={{ width: "100%", marginTop: 4 }}
                      onClick={() => addQuestion(r.id)}
                    >
                      <Icon.plus /> Question
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Middle: editor */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <QuizMetaCard quiz={quiz} update={updateQuiz} onOpenLobby={openLobby} />
        {currentQuestion && currentRound ? (
          <QuestionEditor
            key={currentQuestion.id}
            round={currentRound}
            q={currentQuestion}
            idx={roundQuestions.findIndex((x) => x.id === currentQuestion.id)}
            onUpdate={(patch) => updateQuestion(currentQuestion.id, patch)}
            onDelete={() => {
              deleteQuestion(currentQuestion.id);
              setSelQ(null);
            }}
          />
        ) : (
          <div
            className="card"
            style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}
          >
            Pick a question from the left or add a new one.
          </div>
        )}
      </div>

      {/* Right: AI generator */}
      <AIGenerator
        quizId={quiz.id}
        roundId={selRound}
        rounds={rounds}
        hasApiKey={hasApiKey}
        provider={provider}
      />
    </div>
  );
}

function QuizMetaCard({
  quiz,
  update,
  onOpenLobby,
}: {
  quiz: Quiz;
  update: (patch: Partial<Quiz>) => void;
  onOpenLobby: () => void;
}) {
  const [title, setTitle] = useState(quiz.title);
  const [price, setPrice] = useState(quiz.price ?? "");
  const [revolut, setRevolut] = useState(quiz.revolut_handle ?? "");
  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <label
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--muted)",
              fontWeight: 600,
            }}
          >
            Quiz title
          </label>
          <input
            className="field"
            type="text"
            value={title}
            style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title !== quiz.title) update({ title });
            }}
          />
        </div>
        <div style={{ width: 160 }}>
          <label
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--muted)",
              fontWeight: 600,
            }}
          >
            Join code
          </label>
          <div
            className="mono"
            style={{
              marginTop: 4,
              padding: "12px 14px",
              border: "2px solid var(--ink)",
              borderRadius: 16,
              background: "var(--lime)",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {quiz.code}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 18,
          marginTop: 18,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input
            type="checkbox"
            checked={quiz.paid}
            onChange={(e) => update({ paid: e.target.checked })}
            style={{ width: 18, height: 18 }}
          />
          Paid quiz
        </label>
        {quiz.paid && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Price</span>
              <input
                className="field"
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onBlur={() => {
                  if (price !== (quiz.price ?? "")) update({ price });
                }}
                style={{ width: 80 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 220 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Revolut</span>
              <input
                className="field"
                type="text"
                value={revolut}
                placeholder="@your-handle"
                onChange={(e) => setRevolut(e.target.value)}
                onBlur={() => {
                  if (revolut !== (quiz.revolut_handle ?? ""))
                    update({ revolut_handle: revolut });
                }}
              />
            </div>
          </>
        )}
        <Link href={`/host/${quiz.id}/run`} className="btn primary">
          <Icon.eye /> Open Run Live
        </Link>
        {quiz.status === "draft" && (
          <button className="btn cobalt" onClick={onOpenLobby}>
            <Icon.eye /> Open lobby
          </button>
        )}
      </div>
    </div>
  );
}

function QuestionEditor({
  round,
  q,
  idx,
  onUpdate,
  onDelete,
}: {
  round: Round;
  q: Question;
  idx: number;
  onUpdate: (patch: Partial<Question>) => void;
  onDelete: () => void;
}) {
  // Local editor state. The parent keys this component by q.id, so a new
  // question selection remounts and re-initializes. While mounted we ignore
  // parent updates for text fields (to avoid realtime echoes wiping in-flight
  // typing) and flush to the server on blur.
  const [prompt, setPrompt] = useState(q.prompt);
  const [answerText, setAnswerText] = useState(q.answer_text ?? "");
  const [choices, setChoices] = useState<string[]>(q.choices ?? []);

  const flushChoice = (next: string[]) => {
    setChoices(next);
    onUpdate({ choices: next });
  };

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <span className="chip filled mono" style={{ fontSize: 12 }}>
          {round.title} · Q{idx + 1}
        </span>
        <QTypeBadge type={q.type} />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Points</span>
          <input
            type="number"
            defaultValue={q.points}
            onBlur={(e) => {
              const next = Number(e.target.value);
              if (next !== q.points) onUpdate({ points: next });
            }}
            className="field"
            style={{ width: 72 }}
          />
        </div>
        <button
          className="btn sm"
          onClick={onDelete}
          style={{ background: "var(--mag)", color: "#fff" }}
        >
          <Icon.trash />
        </button>
      </div>

      <Label>Type</Label>
      <div
        style={{
          display: "flex",
          gap: 6,
          marginTop: 6,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {QTYPES.map((t) => (
          <button
            key={t}
            onClick={() => onUpdate({ type: t })}
            style={{
              border: "2px solid var(--ink)",
              borderRadius: 999,
              padding: "6px 12px",
              background: q.type === t ? "var(--ink)" : "var(--card)",
              color: q.type === t ? "var(--paper)" : "var(--ink)",
              fontSize: 12,
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {t === "truefalse" ? "True/False" : t}
          </button>
        ))}
      </div>

      <Label>Question</Label>
      <textarea
        className="field"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() => {
          if (prompt !== q.prompt) onUpdate({ prompt });
        }}
        rows={2}
        style={{ marginTop: 6, marginBottom: 16, fontSize: 16 }}
      />

      {q.type === "closed" && (
        <>
          <Label>Choices</Label>
          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {choices.map((c, i) => (
              <div
                key={i}
                style={{ display: "flex", gap: 8, alignItems: "center" }}
              >
                <button
                  onClick={() => onUpdate({ answer_index: i })}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: "2px solid var(--ink)",
                    background:
                      q.answer_index === i ? "var(--mint)" : "var(--card)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </button>
                <input
                  className="field"
                  value={c}
                  onChange={(e) => {
                    const nc = [...choices];
                    nc[i] = e.target.value;
                    setChoices(nc);
                  }}
                  onBlur={() => {
                    if (
                      choices[i] !== (q.choices ?? [])[i]
                    )
                      onUpdate({ choices });
                  }}
                />
                <button
                  className="btn sm ghost"
                  onClick={() => {
                    const nc = choices.filter((_, idx2) => idx2 !== i);
                    const nextAnswer =
                      q.answer_index === i
                        ? null
                        : q.answer_index !== null && q.answer_index > i
                        ? q.answer_index - 1
                        : q.answer_index;
                    setChoices(nc);
                    onUpdate({ choices: nc, answer_index: nextAnswer });
                  }}
                >
                  <Icon.x />
                </button>
              </div>
            ))}
            <button
              className="btn sm"
              onClick={() => flushChoice([...choices, "New choice"])}
            >
              <Icon.plus /> Add choice
            </button>
          </div>
        </>
      )}

      {q.type === "truefalse" && (
        <div style={{ marginBottom: 16, display: "flex", gap: 10 }}>
          {[true, false].map((v) => (
            <button
              key={String(v)}
              onClick={() => onUpdate({ answer_bool: v })}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: 16,
                border: "2px solid var(--ink)",
                background: q.answer_bool === v ? "var(--mint)" : "var(--card)",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {v ? "TRUE" : "FALSE"}
            </button>
          ))}
        </div>
      )}

      {(q.type === "open" ||
        q.type === "music" ||
        q.type === "picture" ||
        q.type === "video") && (
        <div style={{ marginBottom: 16 }}>
          <Label>Answer</Label>
          <input
            className="field"
            type="text"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            onBlur={() => {
              if (answerText !== (q.answer_text ?? ""))
                onUpdate({ answer_text: answerText });
            }}
            style={{ marginTop: 6 }}
          />
        </div>
      )}

      {(q.type === "music" || q.type === "picture" || q.type === "video") && (
        <MediaUploader
          questionId={q.id}
          currentUrl={q.media_url}
          type={q.type}
          onUploaded={(url) => onUpdate({ media_url: url })}
        />
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--muted)",
        fontWeight: 600,
      }}
    >
      {children}
    </label>
  );
}

function MediaUploader({
  questionId,
  currentUrl,
  type,
  onUploaded,
}: {
  questionId: string;
  currentUrl: string | null;
  type: "music" | "picture" | "video";
  onUploaded: (url: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const accept =
    type === "picture" ? "image/*" : type === "music" ? "audio/*" : "video/*";

  const handleFile = async (file: File) => {
    setUploading(true);
    const path = `${questionId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("quiz-media")
      .upload(path, file, { upsert: true });
    if (error) {
      toast(error.message, "error");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("quiz-media").getPublicUrl(path);
    onUploaded(data.publicUrl);
    toast("Uploaded", "success");
    setUploading(false);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <Label>Media</Label>
      <div
        style={{
          marginTop: 8,
          padding: 12,
          background: "var(--paper)",
          border: "2px dashed var(--ink)",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {currentUrl ? (
          <span
            className="mono"
            style={{
              fontSize: 12,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {currentUrl.split("/").pop()}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--muted)", flex: 1 }}>
            Upload a file for this question
          </span>
        )}
        <label className="btn sm" style={{ cursor: "pointer" }}>
          <input
            type="file"
            accept={accept}
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            disabled={uploading}
          />
          {uploading ? "Uploading…" : "Upload"}
        </label>
      </div>
      {currentUrl && (
        <div style={{ marginTop: 10 }}>
          {type === "picture" && <PicturePlaceholder url={currentUrl} compact />}
          {type === "music" && <AudioPlaceholder url={currentUrl} />}
          {type === "video" && <VideoPlaceholder url={currentUrl} />}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// AI Generator panel
// ────────────────────────────────────────────────────────────────

function AIGenerator({
  quizId,
  roundId,
  rounds,
  hasApiKey,
  provider,
}: {
  quizId: string;
  roundId: string | null;
  rounds: Round[];
  hasApiKey: boolean;
  provider: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [topic, setTopic] = useState("90s pop culture");
  const [count, setCount] = useState(5);
  const [qType, setQType] = useState("mixed");
  const [diff, setDiff] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<
    | {
        type: QuestionType;
        prompt: string;
        choices?: string[];
        answer_text?: string;
        answer_index?: number;
        answer_bool?: boolean;
        points: number;
      }[]
    | null
  >(null);
  const [asNewRound, setAsNewRound] = useState(false);

  const generate = async () => {
    setLoading(true);
    setPreview(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, count, qType, difficulty: diff }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Generation failed");
      setPreview(body.questions);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  const insert = async () => {
    if (!preview || preview.length === 0) return;
    let targetRoundId = roundId;
    if (asNewRound) {
      const { data: newR } = await supabase
        .from("rounds")
        .insert({
          quiz_id: quizId,
          title: `Round · ${topic}`,
          position: rounds.length,
        })
        .select()
        .single();
      targetRoundId = newR?.id ?? null;
    }
    if (!targetRoundId) {
      toast("Select a round first", "error");
      return;
    }

    const { count: existing } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("round_id", targetRoundId);
    const base = existing ?? 0;

    const rows = preview.map((p, i) => ({
      round_id: targetRoundId,
      type: p.type,
      prompt: p.prompt,
      choices: p.choices ?? null,
      answer_text: p.answer_text ?? null,
      answer_index: p.answer_index ?? null,
      answer_bool: p.answer_bool ?? null,
      points: p.points,
      position: base + i,
    }));
    const { error } = await supabase.from("questions").insert(rows);
    if (error) toast(error.message, "error");
    else {
      toast(`Added ${rows.length} questions`, "success");
      setPreview(null);
    }
  };

  return (
    <div
      className="card"
      style={{
        padding: 20,
        background: "var(--lime)",
        position: "sticky",
        top: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <Icon.sparkle />
        <h3 style={{ margin: 0, fontSize: 16 }}>AI Generator</h3>
        {!hasApiKey && (
          <Link
            href="/settings"
            className="chip mag"
            style={{ fontSize: 10, marginLeft: "auto", textDecoration: "none" }}
          >
            Add key
          </Link>
        )}
      </div>

      <label style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600 }}>
        Topic
      </label>
      <input
        className="field"
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. Premier League 2020s"
        style={{ marginTop: 4, marginBottom: 12 }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <label style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600 }}>
            Count
          </label>
          <input
            className="field"
            type="number"
            value={count}
            min={1}
            max={15}
            onChange={(e) => setCount(Number(e.target.value))}
            style={{ marginTop: 4 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600 }}>
            Difficulty
          </label>
          <select
            className="field"
            value={diff}
            onChange={(e) => setDiff(e.target.value)}
            style={{ marginTop: 4 }}
          >
            <option>easy</option>
            <option>medium</option>
            <option>hard</option>
            <option>pub-level</option>
          </select>
        </div>
      </div>

      <label style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 600 }}>
        Question types
      </label>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          marginTop: 6,
          marginBottom: 12,
        }}
      >
        {["mixed", "closed", "open", "truefalse"].map((t) => (
          <button
            key={t}
            onClick={() => setQType(t)}
            style={{
              border: "2px solid var(--ink)",
              borderRadius: 999,
              padding: "4px 10px",
              background: qType === t ? "var(--ink)" : "var(--card)",
              color: qType === t ? "var(--paper)" : "var(--ink)",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          marginBottom: 12,
        }}
      >
        <input
          type="checkbox"
          checked={asNewRound}
          onChange={(e) => setAsNewRound(e.target.checked)}
        />
        Create as new round
      </label>

      <button
        className="btn primary lg"
        style={{ width: "100%" }}
        onClick={generate}
        disabled={loading || !topic.trim()}
      >
        {loading ? (
          <>
            <span className="mono">⟳</span> Generating…
          </>
        ) : (
          <>
            <Icon.sparkle /> Generate
          </>
        )}
      </button>

      {!hasApiKey && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: "var(--card)",
            borderRadius: 10,
            fontSize: 11,
            border: "1.5px dashed var(--ink)",
          }}
        >
          Set an API key in{" "}
          <Link href="/settings" style={{ fontWeight: 700 }}>
            Settings
          </Link>{" "}
          to enable {provider}.
        </div>
      )}

      {preview && (
        <div
          style={{
            marginTop: 14,
            background: "var(--card)",
            border: "2px solid var(--ink)",
            borderRadius: 16,
            padding: 12,
            maxHeight: 340,
            overflow: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <strong style={{ fontSize: 13 }}>Preview ({preview.length})</strong>
            <button className="btn sm" onClick={generate}>
              Regenerate
            </button>
          </div>
          {preview.map((p, i) => (
            <div
              key={i}
              style={{
                padding: "8px 0",
                borderBottom:
                  i < preview.length - 1 ? "1px solid rgba(0,0,0,0.1)" : "none",
                fontSize: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  marginBottom: 2,
                }}
              >
                <span className="mono" style={{ fontSize: 10, opacity: 0.6 }}>
                  {(i + 1).toString().padStart(2, "0")}
                </span>
                <QTypeBadge type={p.type} />
              </div>
              <div style={{ marginTop: 4 }}>{p.prompt}</div>
              <div
                style={{ marginTop: 2, fontSize: 11, color: "var(--muted)" }}
              >
                →{" "}
                {p.type === "closed"
                  ? p.choices?.[p.answer_index ?? 0]
                  : p.type === "truefalse"
                  ? String(p.answer_bool)
                  : p.answer_text}
              </div>
            </div>
          ))}
          <button
            className="btn primary"
            style={{ width: "100%", marginTop: 10 }}
            onClick={insert}
          >
            <Icon.plus /> Add to quiz
          </button>
        </div>
      )}
    </div>
  );
}
