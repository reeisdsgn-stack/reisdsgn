const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-08-07" → "07 ago 2026" (sem fuso: a data é só calendário) */
export function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

export const formatNumber = (n: number) => n.toLocaleString("pt-BR");

export const formatPercent = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
