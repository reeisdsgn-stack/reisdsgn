"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Book, ReadingDay } from "@/lib/types";
import { bookStatus } from "@/lib/types";
import { buildShelves, GROUP_LABEL, matchesQuery, SORT_LABEL, type GroupBy, type SortBy } from "@/lib/shelves";
import { formatNumber } from "@/lib/format";
import { Shelf } from "./Shelf";
import { NowReading, HERO_TILT } from "./NowReading";
import { BookTooltip, type HoverState } from "./BookTooltip";
import { BookViewer, type OpenSource } from "./BookViewer";
import { BookFormSheet } from "./BookFormSheet";
import { ReadingLog } from "./ReadingLog";
import { TopNav } from "./TopNav";
import { toKey } from "@/lib/reading-days";

type Selection = { id: string; source: OpenSource } | null;

// true só no navegador: "hoje" depende do fuso de quem está vendo, não do servidor
const noop = () => () => {};
const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);

export function Library({ books: serverBooks, readingDays }: { books: Book[]; readingDays: ReadingDay[] }) {
  // Lista local: cadastro, edição e exclusão aparecem na hora, sem depender do router.refresh()
  // (que só sincroniza em segundo plano). Quando o servidor manda uma lista nova, ela vence.
  const [books, setBooks] = useState(serverBooks);
  const [syncedFrom, setSyncedFrom] = useState(serverBooks);
  if (serverBooks !== syncedFrom) {
    setSyncedFrom(serverBooks);
    setBooks(serverBooks);
  }

  const [group, setGroup] = useState<GroupBy>("lidos");
  const [sort, setSort] = useState<SortBy>("leitura");
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<HoverState>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const isClient = useIsClient();

  // dias de leitura: atualização otimista (marca na hora, desfaz se o servidor falhar)
  const [days, setDays] = useState(() => new Map(readingDays.map((d) => [d.date, d.bookIds])));
  const [toast, setToast] = useState<string | null>(null);
  const daysRef = useRef(days);
  useEffect(() => {
    daysRef.current = days;
  }, [days]);
  const toggleDay = useCallback(async (date: string, read: boolean, bookIds?: string[]) => {
    const before = daysRef.current.get(date); // undefined = não era dia de leitura
    setDays((cur) => {
      const next = new Map(cur);
      if (read) next.set(date, bookIds ?? cur.get(date) ?? []);
      else next.delete(date);
      return next;
    });
    try {
      const res = await fetch("/api/reading-days", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, read, bookIds: read ? bookIds : undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Não foi possível salvar o dia.");
    } catch (e) {
      // desfaz só este dia (outros cliques feitos no meio tempo continuam valendo)
      setDays((cur) => {
        const next = new Map(cur);
        if (before === undefined) next.delete(date);
        else next.set(date, before);
        return next;
      });
      setToast(e instanceof Error ? e.message : "Não foi possível salvar o dia.");
      setTimeout(() => setToast(null), 4000);
    }
  }, []);
  const readToday = isClient && days.has(toKey(new Date()));

  const tags = useMemo(
    () => ({
      genres: [...new Set(books.flatMap((b) => b.genres))].sort((a, b) => a.localeCompare(b, "pt-BR")),
      themes: [...new Set(books.flatMap((b) => b.themes))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    }),
    [books]
  );

  // depois de salvar, quando o livro novo chega do servidor, abre o painel dele
  useEffect(() => {
    if (!justAdded || !books.some((b) => b.id === justAdded)) return;
    const frame = requestAnimationFrame(() => {
      setSelected({ id: justAdded, source: null });
      setJustAdded(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [books, justAdded]);

  const reading = useMemo(() => books.filter((b) => bookStatus(b) === "lendo"), [books]);
  const navItems = useMemo(
    () => [
      { id: "estante", label: "Tudo o que já li" },
      ...(reading.length ? [{ id: "lendo", label: "Lendo agora" }] : []),
      { id: "ritmo", label: "Ritmo de leitura" },
    ],
    [reading.length]
  );
  const filtered = useMemo(() => books.filter((b) => matchesQuery(b, query)), [books, query]);
  const shelves = useMemo(() => buildShelves(filtered, group, sort), [filtered, group, sort]);
  // ordem de navegação do painel = ordem visual das estantes (sem repetir)
  const order = useMemo(() => {
    const seen = new Set<string>();
    return shelves.flatMap((s) => s.books).filter((b) => !seen.has(b.id) && seen.add(b.id));
  }, [shelves]);

  const totals = useMemo(() => {
    const read = books.filter((b) => b.readings.some((r) => r.status === "lido"));
    return {
      books: books.length,
      pages: books.reduce((n, b) => n + b.readings.reduce((m, r) => m + r.pagesRead, 0), 0),
      read: read.length,
      notes: books.filter((b) => b.notes.length).length,
    };
  }, [books]);

  // abre direto pelo link (?livro=...)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("livro");
    if (!id || !books.some((b) => b.id === id)) return;
    const frame = requestAnimationFrame(() => setSelected({ id, source: null }));
    return () => cancelAnimationFrame(frame);
  }, [books]);

  const syncUrl = (id: string | null) => {
    const url = id ? `?livro=${encodeURIComponent(id)}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  };

  const onHover = useCallback((book: Book | null, el?: HTMLElement) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (!book || !el) {
      hoverTimer.current = setTimeout(() => setHover(null), 90);
      return;
    }
    const r = el.getBoundingClientRect();
    const x = Math.max(140, Math.min(window.innerWidth - 140, r.left + r.width / 2));
    setHover({ book, x, y: r.top - 34 });
  }, []);

  useEffect(() => {
    const clear = () => setHover(null);
    window.addEventListener("scroll", clear, { passive: true });
    return () => window.removeEventListener("scroll", clear);
  }, []);

  const onOpen = useCallback((book: Book, el: HTMLElement) => {
    const isCover = !!el.dataset.coverId;
    const tilt = isCover ? HERO_TILT : 0;
    setHover(null);
    setSelected({
      id: book.id,
      source: { kind: isCover ? "cover" : "spine", rect: el.getBoundingClientRect(), tilt, lifted: el.matches(":hover") },
    });
    syncUrl(book.id);
  }, []);

  return (
    <div className="relative">
      <div className="ambient" />

      <div className="relative z-10">
        <TopNav
          items={navItems}
          showToday={isClient}
          readToday={readToday}
          onToggleToday={() => toggleDay(toKey(new Date()), !readToday, readToday ? undefined : [])}
          onAdd={() => setAdding(true)}
        />

        <header className="relative mx-auto flex max-w-6xl flex-col items-center px-6 pt-10 pb-16 text-center">
          <Title />
          <motion.p
            className="mt-6 font-medium text-[10px] tracking-[0.22em] text-accent uppercase"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
          >
            {totals.books} volumes · {formatNumber(totals.pages)} páginas lidas · {totals.notes} com anotações
          </motion.p>
        </header>

        <div id="estante" className="scroll-mt-20" />
        <Controls
          query={query}
          setQuery={setQuery}
          group={group}
          setGroup={setGroup}
          sort={sort}
          setSort={setSort}
          count={filtered.length}
        />

        <LayoutGroup>
          <div className="flex flex-col gap-20 pb-28">
            <AnimatePresence mode="popLayout">
              {shelves.map((s, i) => (
                <Shelf
                  key={`${group}:${s.key}`}
                  group={s}
                  index={i}
                  hiddenId={selected?.id ?? null}
                  onHover={onHover}
                  onOpen={onOpen}
                />
              ))}
            </AnimatePresence>
            {shelves.length === 0 && (
              <div className="mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center">
                <p className="font-[family-name:var(--font-instrument)] text-3xl text-ink">Sua estante está vazia.</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Adicione seu primeiro livro para começar a construir sua biblioteca.
                </p>
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="mt-6 rounded-full bg-accent px-6 py-3 text-[11px] font-medium tracking-[0.16em] text-accent-ink uppercase transition hover:brightness-110"
                >
                  Adicionar primeiro livro
                </button>
              </div>
            )}
          </div>
        </LayoutGroup>

        <div id="lendo" className="scroll-mt-24 pb-28">
          <NowReading books={reading} hiddenId={selected?.id ?? null} onOpen={onOpen} />
        </div>

        <div id="ritmo" className="scroll-mt-24 pb-28">
          {isClient ? (
            <ReadingLog days={days} reading={reading} books={books} onToggleDay={toggleDay} />
          ) : (
            <div className="h-[520px]" aria-hidden />
          )}
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm text-bg shadow-lg"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="pb-12 text-center text-[10px] font-medium tracking-[0.22em] text-muted uppercase">
          Sua biblioteca, do seu jeito
        </footer>
      </div>

      <BookTooltip hover={selected || adding || editing ? null : hover} />

      <AnimatePresence>
        {adding && (
          <BookFormSheet
            key="add"
            genres={tags.genres}
            themes={tags.themes}
            onClose={() => setAdding(false)}
            onSaved={(book) => {
              setAdding(false);
              setBooks((list) => [...list.filter((b) => b.id !== book.id), book]);
              setJustAdded(book.id);
              syncUrl(book.id);
              router.refresh();
            }}
          />
        )}
        {editing && (
          <BookFormSheet
            key={`edit-${editing.id}`}
            book={editing}
            genres={tags.genres}
            themes={tags.themes}
            onClose={() => setEditing(null)}
            onSaved={(book) => {
              setEditing(null);
              setBooks((list) => list.map((b) => (b.id === book.id ? book : b))); // o painel aberto já mostra os dados novos
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>

      {selected && (
        <BookViewer
          books={order.some((b) => b.id === selected.id) ? order : books}
          bookId={selected.id}
          source={selected.source}
          onNavigate={(id) => {
            setSelected((s) => (s ? { ...s, id } : s));
            syncUrl(id);
          }}
          onClosed={() => {
            setSelected(null);
            syncUrl(null);
          }}
          onEdit={(book) => setEditing(book)}
          paused={!!editing}
          onDeleted={(id) => {
            setSelected(null);
            setBooks((list) => list.filter((b) => b.id !== id));
            syncUrl(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Title() {
  const words = [
    { text: "Minha", italic: false },
    { text: "Biblioteca", italic: true }, // igual à logo
  ];
  let n = 0;
  return (
    <h1 className="font-display text-[clamp(3.5rem,9vw,7.5rem)] leading-[0.92] font-normal tracking-[-0.02em]">
      {words.map((w, wi) => (
        <span key={wi} className={`inline-block whitespace-nowrap ${w.italic ? "italic" : ""}`} style={{ perspective: 600 }}>
          {[...w.text].map((ch) => {
            const i = n++;
            return (
              <motion.span
                key={i}
                className="inline-block"
                initial={{ opacity: 0, y: "0.4em", rotateX: -70 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.9, delay: 0.15 + i * 0.045, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: "50% 100%" }}
              >
                {ch}
              </motion.span>
            );
          })}
          {wi < words.length - 1 && <span className="inline-block w-[0.28em]" />}
        </span>
      ))}
    </h1>
  );
}

function Controls({
  query,
  setQuery,
  group,
  setGroup,
  sort,
  setSort,
  count,
}: {
  query: string;
  setQuery: (v: string) => void;
  group: GroupBy;
  setGroup: (g: GroupBy) => void;
  sort: SortBy;
  setSort: (s: SortBy) => void;
  count: number;
}) {
  return (
    <motion.div
      className="mx-auto mt-2 mb-6 flex max-w-3xl flex-col items-center gap-5 px-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 1 }}
    >
      <label className="w-full">
        <span className="sr-only">Buscar</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="O que você procura?"
          className="w-full border-b border-faint bg-transparent pb-3 text-center text-xl font-light italic placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />
      </label>
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <Segmented label="Agrupar" value={group} options={GROUP_LABEL} onChange={setGroup} />
        <Segmented label="Ordem" value={sort} options={SORT_LABEL} onChange={setSort} />
      </div>
      {query && (
        <p className="font-medium text-[10px] tracking-[0.2em] text-muted uppercase">
          {count} {count === 1 ? "livro encontrado" : "livros encontrados"}
        </p>
      )}
    </motion.div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden font-medium text-[9px] tracking-[0.22em] text-muted uppercase sm:inline">{label}</span>
      <div className="relative flex rounded-full border border-faint p-0.5" role="group" aria-label={label}>
        {(Object.keys(options) as T[]).map((k) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            aria-pressed={value === k}
            className={`relative rounded-full px-2.5 py-1.5 font-medium text-[10px] tracking-[0.14em] uppercase transition-colors sm:px-3 sm:tracking-[0.18em] ${
              value === k ? "text-accent-ink" : "text-muted hover:text-ink"
            }`}
          >
            {value === k && (
              <motion.span
                layoutId={`seg-${label}`}
                className="absolute inset-0 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
            <span className="relative">{options[k]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
