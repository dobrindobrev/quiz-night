"use client";
import { createContext, useContext, useState, useCallback, useEffect } from "react";

type Kind = "info" | "success" | "error";
type ToastMsg = { id: number; msg: string; kind: Kind };

const Ctx = createContext<{ show: (msg: string, kind?: Kind) => void } | null>(
  null
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastMsg | null>(null);

  const show = useCallback((msg: string, kind: Kind = "info") => {
    setToast({ id: Date.now(), msg, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          key={toast.id}
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background:
              toast.kind === "success"
                ? "var(--mint)"
                : toast.kind === "error"
                ? "var(--mag)"
                : "var(--lime)",
            color: toast.kind === "error" ? "#fff" : "var(--ink)",
            border: "3px solid var(--ink)",
            borderRadius: 16,
            padding: "10px 18px",
            boxShadow: "5px 5px 0 var(--ink)",
            zIndex: 10000,
            fontWeight: 600,
            fontSize: 14,
            animation: "slideUp 0.25s ease",
          }}
        >
          {toast.msg}
        </div>
      )}
      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translate(-50%, 20px);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast must be used within ToastProvider");
  return c.show;
}
