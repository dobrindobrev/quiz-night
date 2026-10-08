"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { generateCode } from "@/lib/codes";

const EMOJIS = ["🐻", "🎭", "🦊", "🌻", "⚔️", "🎤", "🚀", "🍕", "🎲", "🧠"];

export function SetupClient({
  quiz,
  teams,
  userId,
}: {
  quiz: { id: string; paid: boolean };
  teams: { id: string; name: string; emoji: string }[];
  userId: string;
}) {
  const supabase = createClient();
  const toast = useToast();
  const [mode, setMode] = useState<"join" | "create">(
    teams.length ? "join" : "create"
  );
  const [newName, setNewName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [busy, setBusy] = useState(false);

  const go = (path: string) => {
    // Force a real navigation so server components refetch membership fresh.
    window.location.assign(path);
  };

  const joinExisting = async (teamId: string) => {
    try {
      setBusy(true);
      const { error } = await supabase
        .from("team_members")
        .insert({ team_id: teamId, user_id: userId });
      if (error) {
        console.error("joinExisting failed", error);
        toast(error.message, "error");
        setBusy(false);
        return;
      }
      go(`/play/${quiz.id}`);
    } catch (e) {
      console.error(e);
      toast((e as Error).message, "error");
      setBusy(false);
    }
  };

  const createTeam = async () => {
    if (!newName.trim()) return toast("Team name required", "error");
    try {
      setBusy(true);
      const { data: team, error } = await supabase
        .from("teams")
        .insert({
          quiz_id: quiz.id,
          name: newName.trim(),
          emoji,
          join_code: generateCode(4),
          paid: false,
          approved: false,
        })
        .select()
        .single();
      if (error || !team) {
        console.error("createTeam (insert team) failed", error);
        toast(error?.message ?? "Could not create team", "error");
        setBusy(false);
        return;
      }
      const { error: mErr } = await supabase
        .from("team_members")
        .insert({ team_id: team.id, user_id: userId, is_captain: true });
      if (mErr) {
        console.error("createTeam (insert member) failed", mErr);
        toast(mErr.message, "error");
        setBusy(false);
        return;
      }
      go(`/play/${quiz.id}`);
    } catch (e) {
      console.error(e);
      toast((e as Error).message, "error");
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: 4,
          background: "var(--ink)",
          borderRadius: 999,
          marginBottom: 14,
        }}
      >
        {(["join", "create"] as const).map((m) => {
          const disabled = m === "join" && teams.length === 0;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              disabled={disabled}
              style={{
                flex: 1,
                border: "none",
                padding: "8px 12px",
                borderRadius: 999,
                background: mode === m ? "var(--paper)" : "transparent",
                color: mode === m ? "var(--ink)" : "var(--paper)",
                fontWeight: 700,
                fontSize: 13,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.4 : 1,
              }}
            >
              {m === "join"
                ? `Join existing${teams.length ? ` (${teams.length})` : ""}`
                : "New team"}
            </button>
          );
        })}
      </div>

      {mode === "join" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => joinExisting(t.id)}
              disabled={busy}
              style={{
                padding: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
                textAlign: "left",
                background: "var(--card)",
                cursor: busy ? "wait" : "pointer",
                border: "2px solid var(--ink)",
                borderRadius: 22,
                boxShadow: "3px 3px 0 var(--ink)",
                width: "100%",
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 28 }}>{t.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{t.name}</div>
              </div>
              <Icon.chev />
            </button>
          ))}
          {teams.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
              No teams yet. Start a new one →
            </div>
          )}
        </div>
      ) : (
        <div>
          <label style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700 }}>
            Team name
          </label>
          <input
            className="field"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. The Know-It-Alls"
            style={{ marginTop: 6 }}
          />
          <label
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              fontWeight: 700,
              marginTop: 14,
              display: "block",
            }}
          >
            Pick a mascot
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                style={{
                  width: 42,
                  height: 42,
                  border: "2px solid var(--ink)",
                  borderRadius: 10,
                  background: e === emoji ? "var(--lime)" : "var(--card)",
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn primary lg"
            style={{ width: "100%", marginTop: 18 }}
            onClick={createTeam}
            disabled={busy || !newName.trim()}
          >
            {busy ? "Creating…" : (
              <>
                Create & continue <Icon.arrow />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
