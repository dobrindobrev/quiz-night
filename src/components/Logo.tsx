export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "var(--lime)",
          border: inverse ? "2px solid var(--paper)" : "2px solid var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink)",
          fontWeight: 800,
          fontSize: 18,
          transform: "rotate(-6deg)",
        }}
      >
        Q
      </div>
      <span
        style={{
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: "-0.01em",
          color: inverse ? "var(--paper)" : "var(--ink)",
        }}
      >
        Quiz Night
      </span>
    </div>
  );
}
