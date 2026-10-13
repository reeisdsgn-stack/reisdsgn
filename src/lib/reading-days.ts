// Dias de leitura: cada dia é uma data local "AAAA-MM-DD" (sem fuso — é calendário, não horário).

export const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Meia-noite local: as contas são sempre em dias inteiros, nunca com a hora atual. */
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Mesmo dia N meses antes (31/05 − 3 meses → 28 ou 29/02). */
export function monthsAgo(d: Date, n: number) {
  const target = new Date(d.getFullYear(), d.getMonth() - n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
}

const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

export type Window = { label: string; read: number; total: number };

/**
 * Contadores pedidos: este mês (do dia 1 até hoje) e os últimos 3, 6 e 12 meses (janelas que terminam hoje).
 */
export function readingStats(days: Set<string>, now = new Date()) {
  const today = startOfDay(now);
  const count = (from: Date) => {
    let read = 0;
    const total = daysBetween(from, today) + 1;
    for (let i = 0; i < total; i++) if (days.has(toKey(addDays(from, i)))) read++;
    return { read, total };
  };

  const windows: Window[] = [
    { label: "Este mês", ...count(new Date(today.getFullYear(), today.getMonth(), 1)) },
    { label: "Últimos 3 meses", ...count(addDays(monthsAgo(today, 3), 1)) },
    { label: "Últimos 6 meses", ...count(addDays(monthsAgo(today, 6), 1)) },
    { label: "Último ano", ...count(addDays(monthsAgo(today, 12), 1)) },
  ];

  // Sequência atual: conta de hoje para trás; se hoje ainda não foi marcado, a sequência de ontem continua valendo
  let streak = 0;
  let cursor = days.has(toKey(today)) ? today : addDays(today, -1);
  while (days.has(toKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  // Maior sequência de todos os tempos
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of [...days].sort()) {
    const d = fromKey(key);
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }

  return { windows, streak, best, total: days.size };
}

/** Grade do calendário (colunas = semanas, domingo a sábado), terminando na semana de hoje. */
export function heatmapWeeks(now = new Date(), weeks = 53) {
  const today = startOfDay(now);
  const end = addDays(today, 6 - today.getDay()); // sábado desta semana
  const start = addDays(end, -(weeks * 7 - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      return { key: toKey(date), date, future: date > today };
    })
  );
}
