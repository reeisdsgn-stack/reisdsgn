import type { ReadingStatus } from "@/lib/types";

// Tokens definidos em globals.css (variam entre tema noite e dia)
const TOKEN: Record<ReadingStatus, string> = {
  lendo: "lendo",
  lido: "lido",
  "quero-ler": "fila",
};

export function StatusPill({ status, label }: { status: ReadingStatus; label: string }) {
  const t = TOKEN[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[9px] leading-none font-medium tracking-[0.2em] uppercase"
      style={{ color: `var(--st-${t}-fg)`, backgroundColor: `var(--st-${t}-bg)`, borderColor: `var(--st-${t}-bd)` }}
    >
      <span className="size-[5px] rounded-full" style={{ backgroundColor: `var(--st-${t}-fg)` }} aria-hidden />
      {label}
    </span>
  );
}
