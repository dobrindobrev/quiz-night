"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { QTypeBadge } from "@/components/QTypeBadge";
import { Confetti } from "@/components/Confetti";
import { PicturePlaceholder, AudioPlaceholder, VideoPlaceholder } from "@/components/Media";
import type { Quiz, Round, Question, Team, Submission } from "@/lib/supabase/types";

export function RunClient({
  quiz: initialQuiz,
  rounds,
  questions,
  initialTeams,
}: {
  quiz: Quiz;
  rounds: Round[];
  questions: Question[];
  initialTeams: Team[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [quiz, setQuiz] = useState(initialQuiz);
  const [teams, setTeams] = useState(initialTeams);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [confettiKey, setConfettiKey] = useState(0);

  // Realtime: quiz, teams, submissions
  useEffect(() => {
    const ch = supabase
      .channel(`run-${quiz.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quizzes", filter: `id=eq.${quiz.id}` },
        (payload) => setQuiz((q) => ({ ...q, ...(payload.new as Quiz) }))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams", filter: `quiz_id=eq.${quiz.id}` },
        async () => {
          const { data } = await supabase
            .from("teams")
            .select("*")
            .eq("quiz_id", quiz.id)
            .order("score", { ascending: false });
          if (data) setTeams(data);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submissions" },
        async () => {
          const { data } = await supabase
            .from("submissions")
            .select("*")
            .in(
              "team_id",
              teams.map((t) => t.id).length ? teams.map((t) => t.id) : ["_"]
            );
          if (data) setSubmissions(data);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [quiz.id, supabase, teams]);

  // Load submissions when question changes
  useEffect(() => {
    const teamIds = teams.filter((t) => t.approved).map((t) => t.id);
    if (!teamIds.length) return;
    const round = rounds[quiz.current_round];
    const q = round?.id
      ? questions.find(
          (x) =>
            x.round_id === round.id &&
            questions
              .filter((y) => y.round_id === round.id)
              .sort((a, b) => a.position - b.position)[quiz.current_question]?.id === x.id
        )
      : null;
    if (!q) return;
    supabase
      .from("submissions")
      .select("*")
      .in("team_id", teamIds)
      .eq("question_id", q.id)
      .then(({ data }) => {
        if (data) setSubmissions(data);
      });
  }, [quiz.current_round, quiz.current_question, teams, rounds, questions, supabase]);

  const updateQuiz = async (patch: Partial<Quiz>) => {
    setQuiz((q) => ({ ...q, ...patch }));
    const { error } = await supabase.from("quizzes").update(patch).eq("id", quiz.id);
    if (error) toast(error.message, "error");
  };

  const openLobby = async () => {
    await updateQuiz({ status: "open" });
    toast("Lobby open — share the code!", "success");
  };

  const closeLobby = async () => updateQuiz({ status: "draft" });

  const startQuiz = async () => {
    const approved = teams.filter((t) => t.approved).length;
    if (approved === 0) return toast("Approve at least one team", "error");
    await updateQuiz({
      status: "running",
      current_round: 0,
      current_question: 0,
      reveal_answer: false,
      question_started_at: new Date().toISOString(),
    });
    toast("Quiz is live!", "success");
  };

  const currentRound = rounds[quiz.current_round];
  const roundQuestions = currentRound
    ? questions
        .filter((q) => q.round_id === currentRound.id)
        .sort((a, b) => a.position - b.position)
    : [];
  const currentQuestion = roundQuestions[quiz.current_question];

  const revealAnswer = async () => {
    if (!currentQuestion) return;
    await updateQuiz({ reveal_answer: true });
    const { error } = await supabase.rpc("score_question", {
      p_question_id: currentQuestion.id,
    });
    if (error) toast(error.message, "error");
  };

  const nextQuestion = async () => {
    if (!currentRound) return;
    if (quiz.current_question < roundQuestions.length - 1) {
      await updateQuiz({
        current_question: quiz.current_question + 1,
        reveal_answer: false,
        question_started_at: new Date().toISOString(),
      });
    } else {
      // End of round -> enter break
      setConfettiKey((k) => k + 1);
      const endsAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      await supabase.rpc("recalc_team_scores", { p_quiz_id: quiz.id });
      await updateQuiz({
        round_break_ends_at: endsAt,
      });
    }
  };

  const endBreak = async () => {
    if (quiz.current_round < rounds.length - 1) {
      await updateQuiz({
        current_round: quiz.current_round + 1,
        current_question: 0,
        reveal_answer: false,
        round_break_ends_at: null,
        question_started_at: new Date().toISOString(),
      });
    } else {
      await updateQuiz({ status: "finished", round_break_ends_at: null });
    }
  };

  const pauseOrResume = async () => {
    await updateQuiz({
      status: quiz.status === "paused" ? "running" : "paused",
    });
  };

  // Screens

  if (quiz.status === "draft") {
    return (
      <div className="card" style={{ padding: 48, textAlign: "center" }}>
        <h2 style={{ margin: 0 }}>Ready to host?</h2>
        <p style={{ color: "var(--muted)", maxWidth: 480, margin: "8px auto 20px" }}>
          Open the lobby so teams can join, then start when everyone&apos;s in.
        </p>
        <button className="btn primary lg" onClick={openLobby}>
          <Icon.eye /> Open lobby
        </button>
      </div>
    );
  }

  if (quiz.status === "open") {
    const approved = teams.filter((t) => t.approved).length;
    const totalQs = rounds.reduce(
      (n, r) => n + questions.filter((q) => q.round_id === r.id).length,
      0
    );
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="chip cobalt" style={{ marginBottom: 12 }}>
            Lobby open
          </div>
          <h2 style={{ margin: 0, fontSize: 32 }}>{quiz.title}</h2>
          <p style={{ color: "var(--muted)" }}>Waiting for teams to join.</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginTop: 20,
            }}
          >
            <Stat label="Teams joined" value={teams.length} color="var(--lime)" />
            <Stat label="Approved" value={approved} color="var(--mint)" />
            <Stat label="Rounds" value={rounds.length} color="var(--sun)" />
            <Stat label="Questions" value={totalQs} color="var(--mag)" textLight />
          </div>
          <div
            style={{
              marginTop: 24,
              padding: 16,
              background: "var(--paper)",
              border: "2px dashed var(--ink)",
              borderRadius: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                fontWeight: 600,
                color: "var(--muted)",
              }}
            >
              Join code
            </div>
            <div
              className="mono"
              style={{ fontSize: 28, fontWeight: 700, marginTop: 4, letterSpacing: "0.05em" }}
            >
              <span style={{ background: "var(--lime)", padding: "0 8px" }}>
                {quiz.code}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              Players enter this at{" "}
              <span className="mono">
                {typeof window !== "undefined" ? window.location.origin : ""}/join
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              className="btn primary lg"
              style={{ flex: 1 }}
              onClick={startQuiz}
              disabled={approved === 0}
            >
              <Icon.play /> Start quiz ({approved} teams)
            </button>
            <button className="btn lg" onClick={closeLobby}>
              Close lobby
            </button>
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>
            Teams in lobby ({teams.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflow: "auto" }}>
            {teams.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
                No teams yet — share the code above.
              </div>
            )}
            {teams.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  background: t.approved ? "var(--mint)" : "var(--paper)",
                  border: "2px solid var(--ink)",
                  borderRadius: 16,
                }}
              >
                <span style={{ fontSize: 24 }}>{t.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {t.paid ? "paid" : "unpaid"} · code {t.join_code}
                  </div>
                </div>
                {!t.approved && (
                  <button
                    className="btn sm lime"
                    onClick={async () => {
                      await supabase
                        .from("teams")
                        .update({ approved: true, paid: true })
                        .eq("id", t.id);
                    }}
                  >
                    <Icon.check /> Approve
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (quiz.status === "finished") {
    return <FinalLeaderboard teams={teams} confettiKey={confettiKey || 1} />;
  }

  if (quiz.round_break_ends_at) {
    return (
      <>
        <Confetti burst={confettiKey} />
        <RoundBreak
          quiz={quiz}
          rounds={rounds}
          teams={teams}
          onNext={endBreak}
        />
      </>
    );
  }

  // Running / paused
  if (!currentRound || !currentQuestion) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
        No question to show.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span className="chip cobalt">{currentRound.title}</span>
          <span className="chip">
            Q {quiz.current_question + 1} / {roundQuestions.length}
          </span>
          <QTypeBadge type={currentQuestion.type} />
          <div style={{ flex: 1 }} />
          <LiveTimer
            startedAt={quiz.question_started_at}
            duration={quiz.question_duration_secs}
            paused={quiz.status === "paused"}
          />
        </div>

        <div className="card" style={{ padding: 32, minHeight: 340 }}>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              color: "var(--muted)",
              letterSpacing: "0.1em",
              fontWeight: 600,
            }}
          >
            Worth {currentQuestion.points}{" "}
            {currentQuestion.points === 1 ? "point" : "points"}
          </div>
          <h2 style={{ fontSize: 32, margin: "10px 0 22px", lineHeight: 1.2 }}>
            {currentQuestion.prompt}
          </h2>
          {currentQuestion.type === "music" && (
            <AudioPlaceholder url={currentQuestion.media_url} />
          )}
          {currentQuestion.type === "picture" && (
            <PicturePlaceholder url={currentQuestion.media_url} />
          )}
          {currentQuestion.type === "video" && (
            <VideoPlaceholder url={currentQuestion.media_url} />
          )}
          <AnswerDisplay q={currentQuestion} reveal={quiz.reveal_answer} />
        </div>

        {quiz.reveal_answer &&
          (currentQuestion.type === "open" ||
            currentQuestion.type === "music" ||
            currentQuestion.type === "picture" ||
            currentQuestion.type === "video") && (
            <OpenMarkingPanel
              questionId={currentQuestion.id}
              teams={teams.filter((t) => t.approved)}
              submissions={submissions.filter(
                (s) => s.question_id === currentQuestion.id
              )}
            />
          )}

        <div style={{ display: "flex", gap: 10 }}>
          {!quiz.reveal_answer ? (
            <button
              className="btn mag lg"
              style={{ flex: 1 }}
              onClick={revealAnswer}
            >
              <Icon.eye /> Reveal answer
            </button>
          ) : (
            <button
              className="btn primary lg"
              style={{ flex: 1 }}
              onClick={nextQuestion}
            >
              <Icon.arrow />{" "}
              {quiz.current_question < roundQuestions.length - 1
                ? "Next question"
                : "End round & score"}
            </button>
          )}
          <button className="btn lg" onClick={pauseOrResume}>
            {quiz.status === "paused" ? <Icon.play /> : <Icon.pause />}
          </button>
        </div>
      </div>

      <LiveSidebar
        teams={teams.filter((t) => t.approved)}
        submissions={submissions.filter(
          (s) => s.question_id === currentQuestion.id
        )}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  textLight,
}: {
  label: string;
  value: number | string;
  color: string;
  textLight?: boolean;
}) {
  return (
    <div
      style={{
        padding: 18,
        background: color,
        border: "2px solid var(--ink)",
        borderRadius: 16,
        color: textLight ? "#fff" : "var(--ink)",
        boxShadow: "3px 3px 0 var(--ink)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          fontWeight: 600,
          opacity: 0.8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 34,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LiveTimer({
  startedAt,
  duration,
  paused,
}: {
  startedAt: string | null;
  duration: number;
  paused: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [paused]);
  if (!startedAt) return null;
  const elapsed = Math.floor((now - new Date(startedAt).getTime()) / 1000);
  const remaining = Math.max(0, duration - elapsed);
  const low = remaining < 10;
  return (
    <div
      className="mono"
      style={{
        background: low ? "var(--mag)" : "var(--lime)",
        color: low ? "#fff" : "var(--ink)",
        border: "2px solid var(--ink)",
        borderRadius: 12,
        padding: "8px 16px",
        fontSize: 24,
        fontWeight: 700,
        minWidth: 80,
        textAlign: "center",
      }}
    >
      {remaining.toString().padStart(2, "0")}s
    </div>
  );
}

function AnswerDisplay({ q, reveal }: { q: Question; reveal: boolean }) {
  if (q.type === "closed") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginTop: 20,
        }}
      >
        {(q.choices ?? []).map((c, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              padding: 14,
              border: "2px solid var(--ink)",
              borderRadius: 16,
              background: reveal && i === q.answer_index ? "var(--mint)" : "var(--card)",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "var(--ink)",
                color: "var(--paper)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {String.fromCharCode(65 + i)}
            </span>
            {c}
            {reveal && i === q.answer_index && (
              <Icon.check style={{ marginLeft: "auto" }} />
            )}
          </div>
        ))}
      </div>
    );
  }
  if (q.type === "truefalse") {
    return (
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {[true, false].map((v) => (
          <div
            key={String(v)}
            style={{
              flex: 1,
              padding: 20,
              borderRadius: 16,
              border: "2px solid var(--ink)",
              background: reveal && q.answer_bool === v ? "var(--mint)" : "var(--card)",
              fontSize: 22,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {v ? "TRUE" : "FALSE"}
          </div>
        ))}
      </div>
    );
  }
  if (reveal) {
    return (
      <div
        style={{
          marginTop: 20,
          padding: 18,
          background: "var(--mint)",
          border: "2px solid var(--ink)",
          borderRadius: 16,
        }}
      >
        <span style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 600 }}>
          Correct answer
        </span>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
          {q.answer_text}
        </div>
      </div>
    );
  }
  return null;
}

function LiveSidebar({
  teams,
  submissions,
}: {
  teams: Team[];
  submissions: Submission[];
}) {
  const answered = submissions.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card" style={{ padding: 18 }}>
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--muted)",
          }}
        >
          Answers in
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
          <span className="mono" style={{ fontSize: 36, fontWeight: 700 }}>
            {answered}
          </span>
          <span style={{ color: "var(--muted)" }}>/ {teams.length} teams</span>
        </div>
        <div
          style={{
            height: 8,
            background: "var(--paper)",
            borderRadius: 4,
            overflow: "hidden",
            border: "1.5px solid var(--ink)",
            marginTop: 10,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${teams.length ? (answered / teams.length) * 100 : 0}%`,
              background: "var(--lime)",
              transition: "width 0.4s",
            }}
          />
        </div>
      </div>
      <div className="card" style={{ padding: 18 }}>
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--muted)",
            marginBottom: 10,
          }}
        >
          Leaderboard
        </div>
        <LeaderboardList teams={teams} compact />
      </div>
    </div>
  );
}

function LeaderboardList({ teams, compact }: { teams: Team[]; compact?: boolean }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sorted.map((t, i) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: compact ? "8px 10px" : "12px 14px",
            background: i === 0 ? "var(--lime)" : "var(--paper)",
            border: "2px solid var(--ink)",
            borderRadius: 10,
          }}
        >
          <span className="mono" style={{ fontSize: 12, width: 18, fontWeight: 700 }}>
            #{i + 1}
          </span>
          <span style={{ fontSize: 18 }}>{t.emoji}</span>
          <span style={{ flex: 1, fontWeight: 600, fontSize: compact ? 13 : 15 }}>
            {t.name}
          </span>
          <span className="mono" style={{ fontWeight: 700 }}>
            {t.score}
          </span>
        </div>
      ))}
    </div>
  );
}

function OpenMarkingPanel({
  questionId,
  teams,
  submissions,
}: {
  questionId: string;
  teams: Team[];
  submissions: Submission[];
}) {
  const supabase = createClient();
  const toast = useToast();
  const mark = async (submissionId: string, correct: boolean) => {
    const { error } = await supabase.rpc("mark_submission", {
      p_submission_id: submissionId,
      p_correct: correct,
    });
    if (error) toast(error.message, "error");
  };
  return (
    <div className="card" style={{ padding: 18, background: "var(--sun)" }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>
        Mark open answers ({submissions.length})
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {submissions.map((s) => {
          const t = teams.find((x) => x.id === s.team_id);
          if (!t) return null;
          const correct = s.host_correct ?? s.auto_correct;
          return (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 10,
                background: "var(--card)",
                border: "2px solid var(--ink)",
                borderRadius: 12,
              }}
            >
              <span style={{ fontSize: 22 }}>{t.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</div>
                <div
                  className="mono"
                  style={{ fontSize: 12, color: "var(--muted)" }}
                >
                  {s.value_text ?? ""}
                </div>
              </div>
              <button
                className={`btn sm ${correct === true ? "lime" : ""}`}
                onClick={() => mark(s.id, true)}
              >
                <Icon.check />
              </button>
              <button
                className={`btn sm`}
                style={
                  correct === false
                    ? { background: "var(--mag)", color: "#fff" }
                    : {}
                }
                onClick={() => mark(s.id, false)}
              >
                <Icon.x />
              </button>
            </div>
          );
        })}
        {submissions.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: 10 }}>
            No submissions yet.
          </div>
        )}
      </div>
    </div>
  );
}

function RoundBreak({
  quiz,
  rounds,
  teams,
  onNext,
}: {
  quiz: Quiz;
  rounds: Round[];
  teams: Team[];
  onNext: () => void;
}) {
  const endsAt = quiz.round_break_ends_at
    ? new Date(quiz.round_break_ends_at).getTime()
    : Date.now();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, endsAt - now);
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const round = rounds[quiz.current_round];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
      }}
    >
      <div className="card" style={{ padding: 28, background: "var(--sun)" }}>
        <div className="chip filled" style={{ marginBottom: 12 }}>
          End of round
        </div>
        <h2 style={{ margin: "4px 0", fontSize: 36 }}>{round?.title}</h2>
        <p style={{ fontSize: 16 }}>
          Scoring + evaluation break. Teams can review.
        </p>
        <div
          className="mono"
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1,
            marginTop: 10,
          }}
        >
          {mins}:{secs.toString().padStart(2, "0")}
        </div>
        <div
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 600,
          }}
        >
          Evaluation break
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
          <button className="btn primary lg" onClick={onNext}>
            {quiz.current_round < rounds.length - 1
              ? "Start next round"
              : "Reveal final scores"}{" "}
            <Icon.arrow />
          </button>
        </div>
      </div>
      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 18 }}>
          <Icon.trophy /> Leaderboard
        </h3>
        <LeaderboardList teams={teams.filter((t) => t.approved)} />
      </div>
    </div>
  );
}

function FinalLeaderboard({
  teams,
  confettiKey,
}: {
  teams: Team[];
  confettiKey: number;
}) {
  const sorted = [...teams.filter((t) => t.approved)].sort(
    (a, b) => b.score - a.score
  );
  const winner = sorted[0];
  return (
    <>
      <Confetti burst={confettiKey} />
      {winner && (
        <div
          className="card"
          style={{ padding: 40, background: "var(--lime)", textAlign: "center" }}
        >
          <div
            style={{
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 600,
            }}
          >
            And the winner is
          </div>
          <div style={{ fontSize: 96, marginTop: 10 }}>{winner.emoji}</div>
          <h1 style={{ fontSize: 72, margin: "4px 0", lineHeight: 1 }}>
            {winner.name}
          </h1>
          <div className="mono" style={{ fontSize: 32, fontWeight: 700 }}>
            {winner.score} pts
          </div>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
          marginTop: 20,
        }}
      >
        {sorted.slice(1, 4).map((t, i) => (
          <div
            key={t.id}
            className="card"
            style={{ padding: 22, textAlign: "center" }}
          >
            <div className="mono" style={{ fontSize: 13, opacity: 0.6 }}>
              #{i + 2}
            </div>
            <div style={{ fontSize: 42 }}>{t.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{t.name}</div>
            <div className="mono" style={{ marginTop: 4 }}>
              {t.score} pts
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
