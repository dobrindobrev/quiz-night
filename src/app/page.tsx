import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";

export default async function Landing() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const signedIn = !!user;

  return (
    <div
      className="dotted"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <div style={{ maxWidth: 980, width: "100%" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 32,
          }}
        >
          <Logo />
          {signedIn ? (
            <form action="/auth/signout" method="post">
              <button className="btn sm ghost">Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="btn sm">
              Sign in
            </Link>
          )}
        </header>

        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px 14px",
              background: "var(--lime)",
              border: "2px solid var(--ink)",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            🎉 Pub Quiz · Live
          </div>
          <h1
            style={{
              fontSize: "clamp(48px, 8vw, 96px)",
              margin: 0,
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              textWrap: "balance" as never,
            }}
          >
            Run a quiz night
            <br />
            <span
              style={{
                background: "var(--mag)",
                color: "#fff",
                padding: "0 18px",
                display: "inline-block",
                transform: "rotate(-2deg)",
                borderRadius: 18,
                border: "2px solid var(--ink)",
                boxShadow: "5px 5px 0 var(--ink)",
              }}
            >
              that slaps.
            </span>
          </h1>
          <p
            style={{
              fontSize: 18,
              color: "var(--muted)",
              maxWidth: 560,
              margin: "20px auto 0",
            }}
          >
            Generate rounds with AI, take entries via Revolut, and run the whole
            night — live sync between your laptop and every player&apos;s phone.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          <LaunchCard
            href={signedIn ? "/quizzes" : "/login?next=/quizzes"}
            bg="var(--ink)"
            fg="var(--paper)"
            label="Host view"
            title="I'm running the night"
            desc="Build rounds, generate AI questions, approve payments, drive the live show."
            cta="Open host console →"
            ctaBg="var(--lime)"
            ctaFg="var(--ink)"
          />
          <LaunchCard
            href={signedIn ? "/join" : "/login?next=/join"}
            bg="var(--mag)"
            fg="#fff"
            label="Player view"
            title="I'm on a team"
            desc="Join a quiz, pay entry via Revolut, answer questions with your teammates."
            cta="Enter as player →"
            ctaBg="var(--sun)"
            ctaFg="var(--ink)"
          />
        </div>
        <div
          style={{
            marginTop: 24,
            textAlign: "center",
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          Both views share live state — open them on different devices to see it
          propagate.
        </div>
      </div>
    </div>
  );
}

function LaunchCard({
  href,
  bg,
  fg,
  label,
  title,
  desc,
  cta,
  ctaBg,
  ctaFg,
}: {
  href: string;
  bg: string;
  fg: string;
  label: string;
  title: string;
  desc: string;
  cta: string;
  ctaBg: string;
  ctaFg: string;
}) {
  return (
    <Link
      href={href}
      style={{
        background: bg,
        color: fg,
        border: "3px solid var(--ink)",
        borderRadius: 32,
        boxShadow: "8px 8px 0 var(--ink)",
        padding: 28,
        textAlign: "left",
        textDecoration: "none",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          opacity: 0.7,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <h2
        style={{
          fontSize: 32,
          margin: 0,
          lineHeight: 1.05,
          textWrap: "balance" as never,
        }}
      >
        {title}
      </h2>
      <p style={{ fontSize: 14, margin: 0, opacity: 0.85, lineHeight: 1.5 }}>
        {desc}
      </p>
      <span
        style={{
          alignSelf: "flex-start",
          marginTop: 4,
          background: ctaBg,
          color: ctaFg,
          padding: "10px 16px",
          borderRadius: 999,
          fontWeight: 700,
          fontSize: 14,
          border: "2px solid var(--ink)",
        }}
      >
        {cta}
      </span>
    </Link>
  );
}
