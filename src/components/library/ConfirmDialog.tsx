"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";

type Props = {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Aviso de confirmação para ações que não têm volta. */
export function ConfirmDialog({ title, children, confirmLabel, busy, error, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    // captura antes do painel do livro: Esc fecha só o aviso, setas não navegam por trás
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") return;
      if (e.key === "Escape" || e.key.startsWith("Arrow")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.key === "Escape" && !busy) onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-6" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <motion.div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !busy && onCancel()}
      />
      <motion.div
        className="relative w-full max-w-md rounded-xl border border-faint bg-bg p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      >
        <h2 id="confirm-title" className="font-display text-3xl leading-tight">
          {title}
        </h2>
        <div className="mt-3 text-[15px] leading-relaxed text-muted">{children}</div>
        {error && <p className="mt-4 text-sm text-[var(--ribbon)]">{error}</p>}
        <div className="mt-7 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border border-faint px-4 py-2.5 text-[11px] font-medium tracking-[0.16em] uppercase transition hover:bg-faint disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-full px-4 py-2.5 text-[11px] font-medium tracking-[0.16em] text-white uppercase transition hover:brightness-110 disabled:opacity-60"
            style={{ backgroundColor: "var(--ribbon)" }}
          >
            {busy ? "Excluindo…" : confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
