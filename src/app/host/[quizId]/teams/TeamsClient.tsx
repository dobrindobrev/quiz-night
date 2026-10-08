"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import type { Team } from "@/lib/supabase/types";

export function TeamsClient({
  quiz,
  initialTeams,
}: {
  quiz: {
    id: string;
    title: string;
    code: string;
    paid: boolean;
    price: string | null;
    revolut_handle: string | null;
  };
  initialTeams: Team[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const [teams, setTeams] = useState(initialTeams);

  useEffect(() => {
    const ch = supabase
      .channel(`teams-${quiz.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `quiz_id=eq.${quiz.id}`,
        },
        async () => {
          const { data } = await supabase
            .from("teams")
            .select("*")
            .eq("quiz_id", quiz.id)
            .order("created_at");
          if (data) setTeams(data);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [quiz.id, supabase]);

  const approve = async (t: Team) => {
    const { error } = await supabase
      .from("teams")
      .update({ approved: true, paid: true })
      .eq("id", t.id);
    if (error) toast(error.message, "error");
    else toast(`${t.name} approved`, "success");
  };
  const markPaid = async (t: Team) => {
    const { error } = await supabase
      .from("teams")
      .update({ paid: !t.paid })
      .eq("id", t.id);
    if (error) toast(error.message, "error");
  };
  const reject = async (t: Team) => {
    if (!confirm(`Remove team ${t.name}?`)) return;
    const { error } = await supabase.from("teams").delete().eq("id", t.id);
    if (error) toast(error.message, "error");
  };

  const pending = teams.filter((t) => !t.approved);
  const approved = teams.filter((t) => t.approved);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        alignItems: "start",
      }}
    >
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span className="chip mag" style={{ color: "#fff" }}>
            Pending · {pending.length}
          </span>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            {quiz.paid ? "Approve after payment" : "Approve to let them in"}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pending.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: "var(--muted)" }}>
              Nobody pending 🎉
            </div>
          )}
          {pending.map((t) => (
            <PendingCard
              key={t.id}
              team={t}
              paid={quiz.paid}
              price={quiz.price}
              revolut={quiz.revolut_handle}
              onApprove={() => approve(t)}
              onMarkPaid={() => markPaid(t)}
              onReject={() => reject(t)}
            />
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span className="chip mint">Approved · {approved.length}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {approved.map((t) => (
            <ApprovedRow key={t.id} team={t} onReject={() => reject(t)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PendingCard({
  team,
  paid,
  price,
  revolut,
  onApprove,
  onMarkPaid,
  onReject,
}: {
  team: Team;
  paid: boolean;
  price: string | null;
  revolut: string | null;
  onApprove: () => void;
  onMarkPaid: () => void;
  onReject: () => void;
}) {
  return (
    <div
      style={{
        border: "2px solid var(--ink)",
        borderRadius: 16,
        padding: 14,
        background: "var(--paper)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 28 }}>{team.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{team.name}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
            code {team.join_code}
          </div>
        </div>
        {paid && (
          <span
            className={`chip ${team.paid ? "mint" : "mag"}`}
            style={{ color: team.paid ? "var(--ink)" : "#fff" }}
          >
            {team.paid ? <><Icon.check /> Paid</> : <><Icon.lock /> Unpaid</>}
          </span>
        )}
      </div>
      {paid && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: "var(--card)",
            border: "1.5px dashed var(--ink)",
            borderRadius: 10,
            fontSize: 12,
          }}
        >
          <span className="mono">
            Expecting {price ?? ""} via Revolut {revolut ?? "(not set)"}
          </span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {paid && (
          <button className="btn sm" onClick={onMarkPaid}>
            {team.paid ? "Mark unpaid" : "Mark paid"}
          </button>
        )}
        <button className="btn sm lime" onClick={onApprove}>
          <Icon.check /> Approve
        </button>
        <button
          className="btn sm"
          onClick={onReject}
          style={{ background: "var(--mag)", color: "#fff" }}
        >
          <Icon.x /> Remove
        </button>
      </div>
    </div>
  );
}

function ApprovedRow({ team, onReject }: { team: Team; onReject: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 12,
        background: "var(--mint)",
        border: "2px solid var(--ink)",
        borderRadius: 16,
      }}
    >
      <span style={{ fontSize: 24 }}>{team.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{team.name}</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {team.score} pts · code {team.join_code}
        </div>
      </div>
      <span className="chip">
        <Icon.check /> Ready
      </span>
      <button
        className="btn sm ghost"
        onClick={onReject}
        style={{ color: "var(--mag)" }}
      >
        <Icon.x />
      </button>
    </div>
  );
}
