"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import type { Book } from "@/lib/types";
import { heatmapWeeks, MONTHS_LONG, MONTHS_SHORT, readingStats, toKey } from "@/lib/reading-days";

type Props = {
  days: Map<string, string[]>; // data → livros lidos naquele dia
  reading: Book[]; // livros em leitura (atalhos para marcar o que leu hoje)
  books: Book[];
  onToggleDay: (date: string, read: boolean, bookIds?: string[]) => void;
};

const WEEKDAYS = ["", "seg", "", "qua", "", "sex", ""];

/** "Ritmo de leitura": marcar o dia de hoje, contadores e o calendário do último ano. */
export function ReadingLog({ days, reading, books, onToggleDay }: Props) {
  const today = useMemo(() => new Date(), []);
  const todayKey = toKey(today);
  const readToday = days.has(todayKey);
  const todayBooks = days.get(todayKey) ?? [];
  const set = useMemo(() => new Set(days.keys()), [days]);
  const stats = useMemo(() => readingStats(set, today), [set, today]);
  const weeks = useMemo(() => heatmapWeeks(today), [today]);
  const titleOf = useMemo(() => new Map(books.map((b) => [b.id, b.title])), [books]);
  const scroller = useRef<HTMLDivElement>(null);

  // no celular o calendário rola: começa mostrando os meses mais recentes
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const toggleBook = (id: string) => {
    const next = todayBooks.includes(id) ? todayBooks.filter((b) => b !== id) : [...todayBooks, id];
    onToggleDay(todayKey, true, next);
  };

  return (
    <section className="mx-auto max-w-6xl px-6" aria-labelledby="ritmo-title">
      <header className="flex flex-col items-center gap-2 text-center">
        <h2 id="ritmo-title" className="font-display text-4xl italic sm:text-5xl">
          Ritmo de leitura
        </h2>
        <span className="text-[10px] font-medium tracking-[0.2em] text-muted uppercase">
          {stats.total} {stats.total === 1 ? "dia registrado" : "dias registrados"}
        </span>
      </header>

      {/* hoje */}
      <div className="mt-10 flex flex-col items-center gap-4">
        <motion.button
          type="button"
          onClick={() => onToggleDay(todayKey, !readToday)}
          whileTap={{ scale: 0.97 }}
          className={`flex items-center gap-3 rounded-full border px-6 py-3.5 text-sm font-medium transition-colors ${
            readToday ? "border-transparent bg-accent text-accent-ink" : "border-faint text-ink hover:border-accent"
          }`}
          aria-pressed={readToday}
        >
          <span
            className={`grid size-5 place-items-center rounded-full border text-[11px] transition-colors ${
              readToday ? "border-accent-ink/40 bg-accent-ink/15" : "border-muted/60"
            }`}
          >
            {readToday ? "✓" : ""}
          </span>
          {readToday ? "Hoje você leu" : "Marcar hoje como dia de leitura"}
          <span className="text-xs opacity-60">
            · {today.getDate()} de {MONTHS_LONG[today.getMonth()]}
          </span>
        </motion.button>

        <AnimatePresence>
          {readToday && reading.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col items-center gap-2 overflow-hidden"
            >
              <span className="text-xs text-muted">O que você leu hoje?</span>
              <div className="flex flex-wrap justify-center gap-1.5">
                {reading.map((b) => {
                  const on = todayBooks.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBook(b.id)}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        on ? "border-accent bg-accent/15 text-ink" : "border-faint text-muted hover:text-ink"
                      }`}
                    >
                      {on ? "✓ " : ""}
                      {b.title}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* contadores */}
      <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.windows.map((w) => (
          <Stat key={w.label} label={w.label} value={w.read} total={w.total} />
        ))}
        <div className="rounded-lg border border-faint px-5 py-4">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted uppercase">Sequência</p>
          <p className="mt-2 font-display text-5xl leading-none">
            {stats.streak}
            <span className="ml-1.5 font-sans text-sm text-muted">{stats.streak === 1 ? "dia" : "dias"}</span>
          </p>
          <p className="mt-3 text-xs text-muted">Recorde: {stats.best} {stats.best === 1 ? "dia" : "dias"}</p>
        </div>
      </div>

      {/* calendário do último ano */}
      <div ref={scroller} className="no-scrollbar mt-10 overflow-x-auto pb-2">
        <div className="mx-auto w-max">
          <div className="flex gap-[3px] pl-8 text-[10px] text-muted">
            {weeks.map((week, i) => {
              const first = week[0].date;
              const prev = weeks[i - 1]?.[0].date;
              const label = !prev || prev.getMonth() !== first.getMonth() ? MONTHS_SHORT[first.getMonth()] : "";
              return (
                <span key={i} className="w-3 overflow-visible whitespace-nowrap">
                  {label}
                </span>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-[3px]">
            <div className="flex w-8 shrink-0 flex-col gap-[3px] text-[10px] leading-3 text-muted">
              {WEEKDAYS.map((d, i) => (
                <span key={i} className="h-3">
                  {d}
                </span>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day) => {
                  if (day.future) return <span key={day.key} className="size-3" />;
                  const read = days.has(day.key);
                  const titles = (days.get(day.key) ?? []).map((id) => titleOf.get(id)).filter(Boolean);
                  const label = `${day.date.getDate()} de ${MONTHS_LONG[day.date.getMonth()]} de ${day.date.getFullYear()}${
                    read ? ` · leu${titles.length ? `: ${titles.join(", ")}` : ""}` : ""
                  }`;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={read}
                      onClick={() => onToggleDay(day.key, !read)}
                      className={`size-3 rounded-[3px] transition-[transform,background-color] duration-200 hover:scale-125 ${
                        read ? "bg-accent" : "bg-faint hover:bg-muted/40"
                      } ${day.key === todayKey ? "ring-1 ring-ink/60 ring-offset-1 ring-offset-bg" : ""}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-3 pl-8 text-[11px] text-muted">Clique num dia para marcar ou desmarcar.</p>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-faint px-5 py-4">
      <p className="text-[10px] font-medium tracking-[0.2em] text-muted uppercase">{label}</p>
      <p className="mt-2 font-display text-5xl leading-none">
        {value}
        <span className="ml-1.5 font-sans text-sm text-muted">{value === 1 ? "dia" : "dias"}</span>
      </p>
      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-faint">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        de {total} · {pct}%
      </p>
    </div>
  );
}
