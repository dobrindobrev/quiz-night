"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import type { Proposal, Question, Team, Vote } from "@/lib/supabase/types";

type Member = { user_id: string; is_captain: boolean; display_name: string };

export function VotingPanel({
  q,
  team,
  members,
  userId,
  isCaptain,
}: {
  q: Question;
  team: Team;
  members: Member[];
  userId: string;
  isCaptain: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [draft, setDraft] = useState<{
    text?: string;
    index?: number;
    bool?: boolean;
  }>({});

  // Load proposals + votes for this question
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: pr }, { data: vt }] = await Promise.all([
        supabase
          .from("proposals")
          .select("*")
          .eq("team_id", team.id)
          .eq("question_id", q.id),
        supabase
          .from("votes")
          .select("*")
          .eq("team_id", team.id)
          .eq("question_id", q.id),
      ]);
      if (cancelled) return;
      setProposals(pr ?? []);
      setVotes(vt ?? []);
    };
    load();

    const ch = supabase
      .channel(`votes-${team.id}-${q.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "proposals",
          filter: `team_id=eq.${team.id}`,
        },
        load
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `team_id=eq.${team.id}`,
        },
        load
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [q.id, team.id, supabase]);

  const myProposal = proposals.find((p) => p.author_id === userId);
  const myVote = votes.find((v) => v.voter_id === userId);

  // Seed draft from my existing proposal
  useEffect(() => {
    if (myProposal) {
      setDraft({
        text: myProposal.value_text ?? undefined,
        index: myProposal.value_index ?? undefined,
        bool: myProposal.value_bool ?? undefined,
      });
    }
  }, [myProposal]);

  const proposeAnswer = async (patch: {
    text?: string;
    index?: number;
    bool?: boolean;
  }) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    const row = {
      team_id: team.id,
      question_id: q.id,
      author_id: userId,
      value_text: next.text ?? null,
      value_index: next.index ?? null,
      value_bool: next.bool ?? null,
    };
    const { data, error } = await supabase
      .from("proposals")
      .upsert(row, { onConflict: "team_id,question_id,author_id" })
      .select()
      .single();
    if (error) return toast(error.message, "error");
    // Auto-vote for self
    if (data && !myVote) {
      await supabase.from("votes").upsert(
        {
          proposal_id: data.id,
          voter_id: userId,
          team_id: team.id,
          question_id: q.id,
        },
        { onConflict: "voter_id,question_id" }
      );
    } else if (data && myVote) {
      // update my vote to point at my proposal
      await supabase
        .from("votes")
        .update({ proposal_id: data.id })
        .eq("id", myVote.id);
    }
  };

  const voteFor = async (proposalId: string) => {
    if (myVote?.proposal_id === proposalId) return;
    const { error } = await supabase.from("votes").upsert(
      {
        proposal_id: proposalId,
        voter_id: userId,
        team_id: team.id,
        question_id: q.id,
      },
      { onConflict: "voter_id,question_id" }
    );
    if (error) toast(error.message, "error");
  };

  const voteCounts = new Map<string, number>();
  for (const v of votes) {
    voteCounts.set(v.proposal_id, (voteCounts.get(v.proposal_id) ?? 0) + 1);
  }
  const leading = [...proposals].sort(
    (a, b) => (voteCounts.get(b.id) ?? 0) - (voteCounts.get(a.id) ?? 0)
  )[0];

  const lockIn = async () => {
    if (!leading) return toast("Propose an answer first", "error");
    const { error } = await supabase.rpc("lock_team_answer", {
      p_team_id: team.id,
      p_question_id: q.id,
    });
    if (error) toast(error.message, "error");
    else toast("Locked in", "success");
  };

  const canLock = isCaptain || members.length === 1;
  const describeProposal = (p: Proposal): string => {
    if (q.type === "closed") return q.choices?.[p.value_index ?? 0] ?? "—";
    if (q.type === "truefalse") return p.value_bool ? "TRUE" : "FALSE";
    return p.value_text ?? "—";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Input area */}
      <div>
        <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700 }}>
          Your proposal
        </div>
        <div style={{ marginTop: 6 }}>
          {q.type === "closed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(q.choices ?? []).map((c, i) => (
                <button
                  key={i}
                  onClick={() => proposeAnswer({ index: i })}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: 14,
                    border: "2px solid var(--ink)",
                    borderRadius: 16,
                    background:
                      draft.index === i ? "var(--lime)" : "var(--card)",
                    textAlign: "left",
                    fontWeight: 600,
                    fontSize: 14,
                    boxShadow: draft.index === i ? "3px 3px 0 var(--ink)" : "none",
                    transform: draft.index === i ? "translate(-1px,-1px)" : "none",
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: "var(--ink)",
                      color: "var(--paper)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span style={{ flex: 1 }}>{c}</span>
                  {draft.index === i && <Icon.check />}
                </button>
              ))}
            </div>
          )}
          {q.type === "truefalse" && (
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { v: true, label: "TRUE", bg: "var(--mint)" },
                { v: false, label: "FALSE", bg: "var(--mag)", fg: "#fff" },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => proposeAnswer({ bool: opt.v })}
                  style={{
                    flex: 1,
                    padding: "22px 10px",
                    borderRadius: 16,
                    border: "2px solid var(--ink)",
                    background: draft.bool === opt.v ? opt.bg : "var(--card)",
                    color:
                      draft.bool === opt.v
                        ? (opt.fg ?? "var(--ink)")
                        : "var(--ink)",
                    fontWeight: 700,
                    fontSize: 18,
                    boxShadow: draft.bool === opt.v ? "3px 3px 0 var(--ink)" : "none",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {(q.type === "open" ||
            q.type === "music" ||
            q.type === "picture" ||
            q.type === "video") && (
            <input
              className="field"
              placeholder="Type your guess…"
              value={draft.text ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              onBlur={() => {
                if (draft.text !== undefined) proposeAnswer({ text: draft.text });
              }}
              style={{ marginTop: 4, fontSize: 16 }}
            />
          )}
        </div>
      </div>

      {/* Team proposals + votes */}
      {members.length > 1 && (
        <div className="card" style={{ padding: 14 }}>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              fontWeight: 700,
              color: "var(--muted)",
              marginBottom: 8,
            }}
          >
            Team votes ({votes.length}/{members.length})
          </div>
          {proposals.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              No proposals yet. Pick one above.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {proposals.map((p) => {
                const count = voteCounts.get(p.id) ?? 0;
                const isLeader = leading?.id === p.id;
                const votedByMe = myVote?.proposal_id === p.id;
                const author = members.find(
                  (m) => m.user_id === p.author_id
                )?.display_name ?? "Player";
                return (
                  <button
                    key={p.id}
                    onClick={() => voteFor(p.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 10,
                      border: "2px solid var(--ink)",
                      borderRadius: 12,
                      background: isLeader ? "var(--lime)" : "var(--card)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      <Icon.vote /> {count}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {describeProposal(p)}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        by {author}
                        {votedByMe && " · your vote"}
                      </div>
                    </div>
                    {votedByMe && <Icon.check />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lock in CTA */}
      <button
        className="btn primary lg"
        onClick={lockIn}
        disabled={!leading || !canLock}
      >
        {canLock ? (
          <>
            Lock in answer <Icon.arrow />
          </>
        ) : (
          <>Waiting for captain to lock</>
        )}
      </button>
      {!canLock && leading && (
        <div
          style={{
            fontSize: 12,
            color: "var(--muted)",
            textAlign: "center",
            marginTop: -6,
          }}
        >
          Only the captain can finalize. Keep voting — top answer is:{" "}
          <strong>{describeProposal(leading)}</strong>
        </div>
      )}
    </div>
  );
}
