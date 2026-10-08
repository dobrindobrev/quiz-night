"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { QTypeBadge } from "@/components/QTypeBadge";
import { Confetti } from "@/components/Confetti";
import { PicturePlaceholder, AudioPlaceholder, VideoPlaceholder } from "@/components/Media";
import { RevolutBlock } from "./_RevolutBlock";
import { VotingPanel } from "./_VotingPanel";
import type {
  Quiz,
  Team,
  Round,
  Question,
  Submission,
} from "@/lib/supabase/types";

type Member = { user_id: string; is_captain: boolean; display_name: string };
type LeaderTeam = {
  id: string;
  name: string;
  emoji: string;
  score: number;
  approved: boolean;
};

export function PlayerClient({
  quiz: initialQuiz,
  team: initialTeam,
  rounds,
  questions,
  userId,
  isCaptain,
  members,
  allTeams: initialAllTeams,
}: {
  quiz: Quiz;
  team: Team;
  rounds: Round[];
  questions: Question[];
  userId: string;
  isCaptain: boolean;
  members: Member[];
  allTeams: LeaderTeam[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [quiz, setQuiz] = useState(initialQuiz);
  const [team, setTeam] = useState(initialTeam);
  const [allTeams, setAllTeams] = useState(initialAllTeams);
  const [submission, setSubmission] = useState<Submission | null>(null);

  // Realtime subscriptions
  useEffect(() => {
    const ch = supabase
      .channel(`player-${quiz.id}-${team.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quizzes", filter: `id=eq.${quiz.id}` },
        (payload) => setQuiz((q) => ({ ...q, ...(payload.new as Quiz) }))
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "teams", filter: `id=eq.${team.id}` },
        (payload) => setTeam((t) => ({ ...t, ...(payload.new as Team) }))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams", filter: `quiz_id=eq.${quiz.id}` },
        async () => {
          const { data } = await supabase
            .from("teams")
            .select("id,name,emoji,score,approved")
            .eq("quiz_id", quiz.id);
          if (data) setAllTeams(data);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [quiz.id, team.id, supabase]);

  const currentRound = rounds[quiz.current_round];
  const roundQuestions = currentRound
    ? questions
        .filter((q) => q.round_id === currentRound.id)
        .sort((a, b) => a.position - b.position)
    : [];
  const currentQuestion = roundQuestions[quiz.current_question];

  // Load submission for current question
  useEffect(() => {
    if (!currentQuestion) return;
    supabase
      .from("submissions")
      .select("*")
      .eq("team_id", team.id)
      .eq("question_id", currentQuestion.id)
      .maybeSingle()
      .then(({ data }) => setSubmission(data ?? null));
    const ch = supabase
      .channel(`submission-${team.id}-${currentQuestion.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submissions",
          filter: `team_id=eq.${team.id}`,
        },
        (payload) => {
          const s = payload.new as Submission;
          if (s && s.question_id === currentQuestion.id) setSubmission(s);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentQuestion, team.id, supabase]);

  // Screen gating

  if (quiz.paid && !team.paid) {
    return (
      <Phone
        headerBg="var(--sun)"
        title="Step 1/2"
        subtitle="Payment pending"
        team={team}
      >
        <PaymentScreen quiz={quiz} team={team} onPaid={async () => {
          const { error } = await supabase
            .from("teams")
            .update({ paid: true })
            .eq("id", team.id);
          if (error) toast(error.message, "error");
          else toast("Sent — waiting for host", "info");
        }} />
      </Phone>
    );
  }

  if (!team.approved) {
    return (
      <Phone
        headerBg="var(--mint)"
        title={quiz.paid ? "Step 2/2" : "Almost in"}
        subtitle="Waiting for host"
        team={team}
      >
        <PendingApproval />
      </Phone>
    );
  }

  if (quiz.status === "draft") {
    return (
      <Phone headerBg="var(--cobalt)" title="Preview" subtitle="Starts soon" team={team}>
        <LobbyPreview quiz={quiz} rounds={rounds} questions={questions} />
      </Phone>
    );
  }

  if (quiz.status === "open") {
    return (
      <Phone headerBg="var(--lime)" title="Ready" subtitle="Host will start soon" team={team}>
        <ReadyScreen team={team} />
      </Phone>
    );
  }

  if (quiz.status === "finished") {
    return (
      <Phone headerBg="var(--lime)" title="Final" subtitle="Quiz complete" team={team}>
        <FinalScreen team={team} allTeams={allTeams.filter((t) => t.approved)} />
      </Phone>
    );
  }

  if (quiz.round_break_ends_at) {
    return (
      <Phone headerBg="var(--sun)" title="Round break" subtitle="Scoring…" team={team}>
        <RoundBreak quiz={quiz} rounds={rounds} allTeams={allTeams.filter((t) => t.approved)} />
      </Phone>
    );
  }

  if (quiz.status === "paused") {
    return (
      <Phone headerBg="var(--sun)" title="Paused" subtitle="Host paused the quiz" team={team}>
        <div style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginTop: 40 }}>⏸</div>
          <h2 style={{ fontSize: 22, margin: "8px 0 4px" }}>Brief intermission</h2>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Hold tight.</p>
        </div>
      </Phone>
    );
  }

  if (!currentQuestion) {
    return (
      <Phone headerBg="var(--cobalt)" team={team}>
        <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
          Nothing to show.
        </div>
      </Phone>
    );
  }

  return (
    <Phone
      headerBg="var(--mag)"
      title={`R${quiz.current_round + 1}·Q${quiz.current_question + 1}`}
      subtitle={currentRound?.title}
      team={team}
    >
      <LiveQuestionScreen
        quiz={quiz}
        q={currentQuestion}
        team={team}
        members={members}
        userId={userId}
        isCaptain={isCaptain}
        submission={submission}
      />
    </Phone>
  );
}

function Phone({
  children,
  headerBg,
  title,
  subtitle,
  team,
}: {
  children: React.ReactNode;
  headerBg: string;
  title?: string;
  subtitle?: string;
  team: Team;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at top, #FFD23A33 0%, transparent 60%), var(--paper)",
        paddingBottom: 24,
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "12px 12px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Link href="/" className="btn sm ghost">
            <Icon.back /> Exit
          </Link>
          <span className="chip mag" style={{ color: "#fff" }}>
            PLAYER
          </span>
        </div>

        <div
          style={{
            background: headerBg,
            padding: "14px 16px 16px",
            border: "2px solid var(--ink)",
            borderRadius: 22,
            boxShadow: "5px 5px 0 var(--ink)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "var(--card)",
                border: "2px solid var(--ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              {team.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {team.name}
              </div>
              {subtitle && (
                <div
                  className="mono"
                  style={{ fontSize: 11, opacity: 0.7 }}
                >
                  {subtitle}
                </div>
              )}
            </div>
            {title && (
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontWeight: 700,
                }}
              >
                {title}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  );
}

function PaymentScreen({
  quiz,
  team,
  onPaid,
}: {
  quiz: Quiz;
  team: Team;
  onPaid: () => void;
}) {
  return (
    <div>
      <div style={{ textAlign: "center", padding: "10px 0 16px" }}>
        <div style={{ fontSize: 52 }}>💸</div>
        <h2 style={{ fontSize: 22, margin: "4px 0" }}>Pay the entry fee</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
          Send {quiz.price ?? ""} via Revolut to join.
        </p>
      </div>
      <RevolutBlock
        handle={quiz.revolut_handle ?? ""}
        price={quiz.price ?? ""}
        reference={team.name}
      />
      <div
        style={{
          padding: 12,
          background: "var(--paper)",
          border: "1.5px dashed var(--ink)",
          borderRadius: 16,
          marginTop: 14,
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        Once you&apos;ve sent it, tap below. The host approves once they see it.
      </div>
      <button className="btn primary lg" style={{ width: "100%", marginTop: 14 }} onClick={onPaid}>
        I&apos;ve paid <Icon.arrow />
      </button>
    </div>
  );
}

function PendingApproval() {
  return (
    <div style={{ padding: "10px 4px", textAlign: "center" }}>
      <div style={{ fontSize: 56, marginTop: 20 }}>⏳</div>
      <h2 style={{ fontSize: 24, margin: "8px 0 4px" }}>Hang tight</h2>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        Host is confirming. Updates appear automatically.
      </p>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 20 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "var(--ink)",
              animation: `pulseDot 1s ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        @keyframes pulseDot {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(0.9);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}

function LobbyPreview({
  quiz,
  rounds,
  questions,
}: {
  quiz: Quiz;
  rounds: Round[];
  questions: Question[];
}) {
  return (
    <div>
      <h2 style={{ fontSize: 22, margin: "0 0 4px" }}>{quiz.title}</h2>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
        Starts when host opens the lobby.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 14,
        }}
      >
        <MiniStat value={rounds.length} label="rounds" bg="var(--lime)" />
        <MiniStat value={questions.length} label="questions" bg="var(--sun)" />
      </div>
      <h3
        style={{
          fontSize: 14,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 20,
        }}
      >
        Rounds
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rounds.map((r, i) => (
          <div
            key={r.id}
            style={{
              padding: 12,
              border: "2px solid var(--ink)",
              borderRadius: 16,
              background: "var(--card)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span className="mono" style={{ fontWeight: 700, fontSize: 16, width: 24 }}>
              {(i + 1).toString().padStart(2, "0")}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title}</div>
            </div>
            <Icon.lock style={{ color: "var(--muted)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({
  value,
  label,
  bg,
}: {
  value: number | string;
  label: string;
  bg: string;
}) {
  return (
    <div
      style={{
        padding: 12,
        background: bg,
        border: "2px solid var(--ink)",
        borderRadius: 16,
        boxShadow: "3px 3px 0 var(--ink)",
      }}
    >
      <div className="mono" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          fontWeight: 700,
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function ReadyScreen({ team }: { team: Team }) {
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 56, marginTop: 20, animation: "pulse 1.8s infinite" }}>
        🎉
      </div>
      <h2 style={{ fontSize: 26, margin: "8px 0 4px" }}>You&apos;re in!</h2>
      <p style={{ color: "var(--muted)", fontSize: 13 }}>
        Quiz starts when the host kicks it off.
      </p>
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: "var(--mag)",
          color: "#fff",
          border: "2px solid var(--ink)",
          borderRadius: 16,
          boxShadow: "5px 5px 0 var(--ink)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            fontWeight: 700,
            letterSpacing: "0.08em",
            opacity: 0.8,
          }}
        >
          Playing as
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>
          {team.emoji} {team.name}
        </div>
      </div>
    </div>
  );
}

function LiveQuestionScreen({
  quiz,
  q,
  team,
  members,
  userId,
  isCaptain,
  submission,
}: {
  quiz: Quiz;
  q: Question;
  team: Team;
  members: Member[];
  userId: string;
  isCaptain: boolean;
  submission: Submission | null;
}) {
  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
        <QTypeBadge type={q.type} />
        <span className="chip mono" style={{ fontSize: 11 }}>
          {q.points}pt{q.points !== 1 ? "s" : ""}
        </span>
        <div style={{ flex: 1 }} />
        <LiveTimer
          startedAt={quiz.question_started_at}
          duration={quiz.question_duration_secs}
          paused={quiz.status === "paused"}
        />
      </div>
      <h2 style={{ fontSize: 22, margin: "2px 0 14px", lineHeight: 1.2 }}>
        {q.prompt}
      </h2>
      {q.type === "music" && (
        <div style={{ marginBottom: 14 }}>
          <AudioPlaceholder url={q.media_url} />
        </div>
      )}
      {q.type === "picture" && (
        <div style={{ marginBottom: 14 }}>
          <PicturePlaceholder url={q.media_url} compact />
        </div>
      )}
      {q.type === "video" && (
        <div style={{ marginBottom: 14 }}>
          <VideoPlaceholder url={q.media_url} />
        </div>
      )}

      {quiz.reveal_answer ? (
        <RevealPanel q={q} submission={submission} />
      ) : submission ? (
        <SubmittedPanel q={q} submission={submission} isCaptain={isCaptain} />
      ) : (
        <VotingPanel
          q={q}
          team={team}
          members={members}
          userId={userId}
          isCaptain={isCaptain}
        />
      )}
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
    const t = setInterval(() => setNow(Date.now()), 500);
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
        padding: "4px 10px",
        borderRadius: 999,
        background: low ? "var(--ink)" : "var(--card)",
        color: low ? "var(--paper)" : "var(--ink)",
        border: "2px solid var(--ink)",
        fontWeight: 700,
        fontSize: 13,
      }}
    >
      ⏱ {remaining}s
    </div>
  );
}

function SubmittedPanel({
  q,
  submission,
  isCaptain,
}: {
  q: Question;
  submission: Submission;
  isCaptain: boolean;
}) {
  let display = "";
  if (q.type === "closed") display = q.choices?.[submission.value_index ?? 0] ?? "";
  else if (q.type === "truefalse") display = submission.value_bool ? "TRUE" : "FALSE";
  else display = submission.value_text ?? "";

  const supabase = createClient();
  const toast = useToast();
  const unlock = async () => {
    const { error } = await supabase
      .from("submissions")
      .delete()
      .eq("id", submission.id);
    if (error) toast(error.message, "error");
    else toast("Unlocked — vote again", "info");
  };

  return (
    <div
      style={{
        padding: 16,
        background: "var(--mint)",
        border: "2px solid var(--ink)",
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "3px 3px 0 var(--ink)",
      }}
    >
      <Icon.check />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>
          Locked in
        </div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{display}</div>
      </div>
      {isCaptain && (
        <button className="btn sm" onClick={unlock}>
          Unlock
        </button>
      )}
    </div>
  );
}

function RevealPanel({
  q,
  submission,
}: {
  q: Question;
  submission: Submission | null;
}) {
  let correct = "";
  if (q.type === "closed")
    correct = q.choices?.[q.answer_index ?? 0] ?? "";
  else if (q.type === "truefalse") correct = q.answer_bool ? "TRUE" : "FALSE";
  else correct = q.answer_text ?? "";

  let yours = "";
  if (submission) {
    if (q.type === "closed") yours = q.choices?.[submission.value_index ?? 0] ?? "—";
    else if (q.type === "truefalse") yours = submission.value_bool ? "TRUE" : "FALSE";
    else yours = submission.value_text ?? "—";
  }

  const got = submission?.awarded_points ?? 0;
  const ok = got > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          padding: 14,
          background: "var(--mint)",
          border: "2px solid var(--ink)",
          borderRadius: 16,
        }}
      >
        <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>
          Correct answer
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{correct}</div>
      </div>
      <div
        style={{
          padding: 14,
          background: ok ? "var(--lime)" : "var(--mag)",
          color: ok ? "var(--ink)" : "#fff",
          border: "2px solid var(--ink)",
          borderRadius: 16,
        }}
      >
        <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>
          Your team
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>
            {yours || "(no answer)"}
          </div>
          <div className="mono" style={{ fontWeight: 700 }}>
            +{got}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoundBreak({
  quiz,
  rounds,
  allTeams,
}: {
  quiz: Quiz;
  rounds: Round[];
  allTeams: LeaderTeam[];
}) {
  const endsAt = quiz.round_break_ends_at
    ? new Date(quiz.round_break_ends_at).getTime()
    : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, endsAt - now);
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const sorted = [...allTeams].sort((a, b) => b.score - a.score);
  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>
        {rounds[quiz.current_round]?.title} — done
      </h2>
      <div className="mono" style={{ fontSize: 56, fontWeight: 700 }}>
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
      <h3
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          marginTop: 20,
          letterSpacing: "0.08em",
        }}
      >
        Leaderboard
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((t, i) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              padding: "10px 12px",
              background: i === 0 ? "var(--lime)" : "var(--card)",
              border: "2px solid var(--ink)",
              borderRadius: 12,
            }}
          >
            <span className="mono" style={{ width: 20 }}>
              #{i + 1}
            </span>
            <span style={{ fontSize: 18 }}>{t.emoji}</span>
            <span style={{ flex: 1, fontWeight: 600 }}>{t.name}</span>
            <span className="mono" style={{ fontWeight: 700 }}>
              {t.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinalScreen({
  team,
  allTeams,
}: {
  team: Team;
  allTeams: LeaderTeam[];
}) {
  const sorted = [...allTeams].sort((a, b) => b.score - a.score);
  const rank = sorted.findIndex((t) => t.id === team.id) + 1;
  const win = rank === 1;
  return (
    <>
      {win && <Confetti burst={1} />}
      <div style={{ padding: "10px 4px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginTop: 10 }}>
          {win ? "🏆" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "👏"}
        </div>
        <div className="mono" style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700 }}>
          You finished
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, fontFamily: "var(--font-mono)", lineHeight: 1 }}>
          #{rank}
        </div>
        <div style={{ marginTop: 4, fontWeight: 700 }}>of {sorted.length} teams</div>
        <div
          style={{
            marginTop: 20,
            padding: 14,
            background: "var(--card)",
            border: "2px solid var(--ink)",
            borderRadius: 16,
          }}
        >
          <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--muted)" }}>
            Final score
          </div>
          <div className="mono" style={{ fontSize: 32, fontWeight: 700 }}>
            {team.score} pts
          </div>
        </div>
      </div>
    </>
  );
}
