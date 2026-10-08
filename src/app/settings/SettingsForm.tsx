"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icon } from "@/components/Icon";

type Provider = "anthropic" | "openai" | "gemini";

export function SettingsForm({
  initial,
}: {
  initial: {
    api_provider: Provider;
    api_key: string;
    revolut_handle: string;
    display_name: string;
  };
}) {
  const supabase = createClient();
  const toast = useToast();
  const [provider, setProvider] = useState<Provider>(initial.api_provider);
  const [apiKey, setApiKey] = useState(initial.api_key);
  const [revolut, setRevolut] = useState(initial.revolut_handle);
  const [name, setName] = useState(initial.display_name);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return { error: { message: "Not signed in" } };
      return supabase
        .from("profiles")
        .update({
          api_provider: provider,
          api_key: apiKey || null,
          revolut_handle: revolut || null,
          display_name: name,
        })
        .eq("id", data.user.id);
    });
    setSaving(false);
    if (error) toast(error.message, "error");
    else toast("Saved", "success");
  };

  const placeholder =
    provider === "anthropic"
      ? "sk-ant-…"
      : provider === "openai"
      ? "sk-…"
      : "AIza…";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 6px" }}>Profile</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>
          Shown to teammates when you join a quiz.
        </p>
        <label style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 600 }}>
          Display name
        </label>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ marginTop: 6 }}
        />
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 6px" }}>
          <Icon.sparkle /> AI Provider
        </h3>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>
          Used to generate questions. Your key is stored encrypted and only sent
          to our server to call the provider.
        </p>
        <label style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 600 }}>
          Provider
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 14 }}>
          {(
            [
              ["anthropic", "Anthropic"],
              ["openai", "OpenAI"],
              ["gemini", "Gemini"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setProvider(v)}
              style={{
                flex: 1,
                border: "2px solid var(--ink)",
                borderRadius: 999,
                padding: "10px 12px",
                background: provider === v ? "var(--ink)" : "var(--card)",
                color: provider === v ? "var(--paper)" : "var(--ink)",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <label style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 600 }}>
          API key
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <input
            className="field"
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={placeholder}
          />
          <button className="btn" onClick={() => setShowKey((k) => !k)}>
            <Icon.eye />
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 22 }}>
        <h3 style={{ margin: "0 0 6px" }}>Payments</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 14px" }}>
          Default Revolut handle for paid quizzes. You can override this per
          quiz.
        </p>
        <label style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 600 }}>
          Revolut handle
        </label>
        <input
          className="field"
          value={revolut}
          onChange={(e) => setRevolut(e.target.value)}
          placeholder="@your-handle"
          style={{ marginTop: 6 }}
        />
      </div>

      <button
        className="btn primary lg"
        onClick={save}
        disabled={saving}
        style={{ alignSelf: "flex-end" }}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
