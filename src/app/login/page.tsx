"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginInner() {
  const search = useSearchParams();
  const next = search.get("next") ?? "/";
  const error = search.get("error");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(
    error === "auth" ? "Could not sign you in. Try again." : null
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          next
        )}`,
      },
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setSent(true);
  };

  return (
    <div
      className="dotted"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="card" style={{ padding: 32, width: "100%", maxWidth: 440 }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 14px",
            background: "var(--lime)",
            border: "2px solid var(--ink)",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          🎉 Quiz Night
        </div>
        <h1 style={{ fontSize: 40, margin: 0, lineHeight: 1.05 }}>
          Let&apos;s get you in.
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>
          We&apos;ll email you a magic link. No passwords.
        </p>

        {sent ? (
          <div
            style={{
              marginTop: 20,
              padding: 16,
              background: "var(--mint)",
              border: "2px solid var(--ink)",
              borderRadius: 16,
            }}
          >
            <strong>Check your inbox</strong>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              A magic link is on its way to <span className="mono">{email}</span>.
              Click it and you&apos;re in.
            </div>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            style={{
              marginTop: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <label
              style={{
                fontSize: 12,
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="field"
            />
            <button className="btn primary lg" disabled={loading}>
              {loading ? "Sending…" : "Send magic link →"}
            </button>
            {err && (
              <div
                style={{
                  padding: 10,
                  background: "var(--mag)",
                  color: "#fff",
                  border: "2px solid var(--ink)",
                  borderRadius: 12,
                  fontSize: 13,
                }}
              >
                {err}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
