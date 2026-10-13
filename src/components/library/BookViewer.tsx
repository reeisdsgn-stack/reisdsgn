"use client";

import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { marked } from "marked";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Book } from "@/lib/types";
import { bookProgress, bookRating, bookStatus, latestReading, STATUS_LABEL } from "@/lib/types";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { Book3D, bookDims } from "./Book3D";
import { lockScroll } from "@/lib/scroll-lock";
import { normalizeMarkdown } from "@/lib/notes";
import { Stars } from "./Stars";
import { StatusPill } from "./StatusPill";
import { ConfirmDialog } from "./ConfirmDialog";

export type OpenSource = { kind: "spine" | "cover"; rect: DOMRect; tilt: number; lifted: boolean } | null;

type Props = {
  books: Book[];
  bookId: string;
  source: OpenSource;
  onNavigate: (id: string) => void;
  onClosed: () => void;
  onEdit: (book: Book) => void;
  onDeleted: (id: string) => void;
  paused?: boolean; // outro painel aberto por cima (ex.: edição): ignora o teclado
};

const FLY_EASE = [0.16, 1, 0.3, 1] as const;
const RETURN_EASE = [0.65, 0, 0.35, 1] as const;
const REST_TILT = 8; // leve giro em repouso: mostra a capa e um filete da lombada
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

function stageFor(book: Book, vp: { w: number; h: number }) {
  const mobile = vp.w < 900;
  const width = mobile
    ? Math.min(vp.w * 0.48, (vp.h * 0.36) / book.coverAspect, 230)
    : Math.max(220, Math.min(vp.w * 0.24, (vp.h * 0.64) / book.coverAspect, 360));
  const dims = bookDims(book, Math.round(width));
  const cx = mobile ? vp.w / 2 : vp.w * 0.28;
  const cy = mobile ? 40 + dims.H / 2 + 16 : vp.h * 0.5;
  return { ...dims, cx, cy, mobile };
}

export function BookViewer({ books, bookId, source, onNavigate, onClosed, onEdit, onDeleted, paused = false }: Props) {
  const reduce = useReducedMotion();
  const vp = useViewport();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [currentId, setCurrentId] = useState(bookId);
  const [panelOn, setPanelOn] = useState(false);
  const [backdrop, setBackdrop] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const busy = useRef(true);
  const book = books.find((b) => b.id === currentId) ?? books[0];
  const stage = stageFor(book, vp);
  const index = books.findIndex((b) => b.id === currentId);
  const t = (s: number) => (reduce ? 0 : s);

  const bookEl = () => scope.current?.querySelector<HTMLElement>("[data-flying-book]") ?? null;

  // ── abrir: do lugar na estante até o palco, girando para mostrar a capa
  useEffect(() => {
    const el = bookEl();
    if (!el) return;
    let cancelled = false;
    (async () => {
      const st = stageFor(book, { w: window.innerWidth, h: window.innerHeight });
      if (source && !reduce) {
        const sx = source.rect.left + source.rect.width / 2;
        const sy = source.rect.top + source.rect.height / 2 - (source.lifted ? 22 : 0);
        const s = source.kind === "spine" ? source.rect.height / st.H : source.rect.width / st.W;
        await animate(
          el,
          {
            x: sx - st.cx,
            y: sy - st.cy,
            z: source.kind === "spine" ? (-st.W * s) / 2 : 0,
            scale: s,
            rotateY: source.kind === "spine" ? 90 + source.tilt : source.tilt,
            opacity: 1,
          },
          { duration: 0 }
        );
        if (cancelled) return;
        setTimeout(() => !cancelled && setPanelOn(true), 380);
        await animate(el, { x: 0, y: 0, z: 0, scale: 1, rotateY: REST_TILT }, { duration: 0.95, ease: FLY_EASE });
      } else {
        await animate(el, { x: 0, y: 0, z: 0, scale: 0.92, rotateY: REST_TILT, opacity: 0 }, { duration: 0 });
        setPanelOn(true);
        await animate(el, { scale: 1, opacity: 1 }, { duration: t(0.5), ease: FLY_EASE });
      }
      if (cancelled) return;
      busy.current = false;
    })();
    return () => {
      cancelled = true;
    };
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── fechar: o livro volta para o seu lugar na estante
  const close = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const el = bookEl();
    setPanelOn(false);
    const st = stageFor(book, { w: window.innerWidth, h: window.innerHeight });
    const coverTarget =
      source?.kind === "cover" ? document.querySelector<HTMLElement>(`[data-cover-id="${book.id}"]`) : null;
    const candidates = coverTarget
      ? [coverTarget]
      : [...document.querySelectorAll<HTMLElement>(`[data-spine-id="${book.id}"]`)];
    const visible = candidates
      .map((c) => ({ c, r: c.getBoundingClientRect() }))
      .filter(({ r }) => r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth);
    const target =
      visible.sort(
        (a, b) =>
          Math.hypot(a.r.left - (source?.rect.left ?? 0), a.r.top - (source?.rect.top ?? 0)) -
          Math.hypot(b.r.left - (source?.rect.left ?? 0), b.r.top - (source?.rect.top ?? 0))
      )[0] ?? null;
    setBackdrop(false);
    if (el && target && !reduce) {
      const r = target.r;
      const kind = target.c.dataset.coverId ? "cover" : "spine";
      const s = kind === "spine" ? r.height / st.H : r.width / st.W;
      const tilt = kind === "spine" ? 0 : 26; // lombada fica de frente; capa do "Lendo agora" gira 26°
      await animate(
        el,
        {
          x: r.left + r.width / 2 - st.cx,
          y: r.top + r.height / 2 - st.cy,
          z: kind === "spine" ? (-st.W * s) / 2 : 0,
          scale: s,
          rotateY: kind === "spine" ? 90 + tilt : tilt,
        },
        { duration: 0.8, ease: RETURN_EASE }
      );
    } else if (el) {
      await animate(el, { opacity: 0, scale: 0.9 }, { duration: t(0.3) });
    }
    onClosed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, source, reduce]);

  // ── anterior / próximo
  const go = useCallback(
    async (dir: 1 | -1) => {
      if (busy.current || books.length < 2) return;
      busy.current = true;
      const el = bookEl();
      const next = books[(index + dir + books.length) % books.length];
      setPanelOn(false);
      if (el) {
        await animate(
          el,
          { x: -dir * 160, rotateY: REST_TILT + dir * 40, opacity: 0 },
          { duration: t(0.32), ease: [0.7, 0, 0.84, 0] }
        );
      }
      setCurrentId(next.id);
      onNavigate(next.id);
      await wait(20);
      const el2 = bookEl();
      if (el2) {
        await animate(el2, { x: dir * 160, rotateY: REST_TILT - dir * 40, opacity: 0, scale: 1, z: 0, y: 0 }, { duration: 0 });
        setPanelOn(true);
        await animate(el2, { x: 0, rotateY: REST_TILT, opacity: 1 }, { duration: t(0.6), ease: FLY_EASE });
      }
      busy.current = false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [books, index, onNavigate, reduce]
  );

  // ── excluir: confirma, apaga no servidor e o livro some do palco
  const remove = useCallback(async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/books/${encodeURIComponent(book.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Não foi possível excluir.");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Não foi possível excluir.");
      setDeleting(false);
      return;
    }
    busy.current = true;
    setConfirming(false);
    setPanelOn(false);
    setBackdrop(false);
    const el = bookEl();
    if (el) await animate(el, { y: 60, scale: 0.85, opacity: 0, rotateY: REST_TILT - 20 }, { duration: t(0.45), ease: [0.7, 0, 0.84, 0] });
    onDeleted(book.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, onDeleted, reduce]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused || e.defaultPrevented) return;
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, go, paused]);

  // trava a rolagem enquanto o painel existe
  useEffect(() => lockScroll(), []);

  // swipe no celular
  const touch = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={scope}
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={book.title}
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        if (!touch.current) return;
        const dx = e.changedTouches[0].clientX - touch.current.x;
        const dy = e.changedTouches[0].clientY - touch.current.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      <motion.button
        aria-label="Fechar"
        className="absolute inset-0 cursor-default bg-bg/70 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: backdrop ? 1 : 0 }}
        transition={{ duration: backdrop ? 0.6 : 0.5 }}
        onClick={close}
      />

      {/* palco 3D */}
      <div className="pointer-events-none absolute inset-0" style={{ perspective: "2000px" }}>
        <div
          data-flying-book
          className="preserve-3d absolute"
          style={{ left: stage.cx - stage.W / 2, top: stage.cy - stage.H / 2, width: stage.W, height: stage.H, opacity: 0 }}
        >
          <Book3D book={book} width={stage.W} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {panelOn && (
          <DetailPanel
            key={book.id}
            book={book}
            mobile={stage.mobile}
            top={stage.mobile ? stage.cy + stage.H / 2 + 28 : undefined}
            index={index}
            total={books.length}
            onPrev={() => go(-1)}
            onNext={() => go(1)}
            onClose={close}
            onEdit={() => onEdit(book)}
            onDelete={() => {
              setDeleteError(null);
              setConfirming(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirming && (
          <ConfirmDialog
            title="Excluir livro?"
            confirmLabel="Excluir"
            busy={deleting}
            error={deleteError}
            onConfirm={remove}
            onCancel={() => setConfirming(false)}
          >
            <strong className="font-medium text-ink">{book.title}</strong> será removido da estante, junto com a capa, as
            leituras e as anotações. Essa ação não pode ser desfeita.
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </div>
  );
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};
const item = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

function DetailPanel({
  book,
  mobile,
  top,
  index,
  total,
  onPrev,
  onNext,
  onClose,
  onEdit,
  onDelete,
}: {
  book: Book;
  mobile: boolean;
  top?: number;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = bookStatus(book);
  const r = latestReading(book);
  const rating = bookRating(book);
  const progress = bookProgress(book);
  const finished = book.readings.filter((x) => x.status === "lido");
  const html = useMemo(
    () => book.notes.map((n) => ({ ...n, html: marked.parse(normalizeMarkdown(n.markdown), { async: false }) as string })),
    [book]
  );

  return (
    <motion.aside
      variants={container}
      initial="hidden"
      animate="show"
      exit="exit"
      className={
        mobile
          ? "absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl border-t border-faint bg-panel px-6 pt-6 backdrop-blur-xl"
          : "absolute top-[8vh] right-[5vw] bottom-[8vh] left-[54vw] flex flex-col"
      }
      style={mobile ? { top } : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <motion.p variants={item} className="font-medium text-[10px] tracking-[0.22em] text-muted uppercase">
          {[STATUS_LABEL[status], ...book.genres].join(" · ")}
        </motion.p>
        <motion.button
          variants={item}
          onClick={onClose}
          className="shrink-0 rounded-full border border-faint px-3 py-1.5 font-medium text-[10px] tracking-[0.2em] text-ink uppercase transition hover:bg-faint"
        >
          Fechar ✕
        </motion.button>
      </div>

      <motion.h2 variants={item} className="mt-3 font-display text-5xl leading-[0.95] tracking-[-0.01em] sm:text-6xl">
        {book.title}
      </motion.h2>
      <motion.p variants={item} className="mt-3 text-lg text-accent italic">
        {book.author}
      </motion.p>

      {status === "lendo" && r && (
        <motion.div variants={item} className="mt-5">
          <div className="h-1 overflow-hidden rounded-full bg-faint">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="mt-2 font-medium text-[11px] tracking-[0.12em] text-muted">
            {formatNumber(r.pagesRead)} de {formatNumber(book.pages)} páginas · {formatPercent(progress)}
          </p>
        </motion.div>
      )}

      <motion.dl variants={item} className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-faint py-5 sm:grid-cols-4">
        <Meta label="Início" value={formatDate(r?.startedAt ?? null)} />
        <Meta label="Término" value={formatDate(r?.finishedAt ?? null)} />
        <Meta label="Páginas" value={formatNumber(book.pages)} />
        <div>
          <dt className="font-medium text-[9px] tracking-[0.2em] text-muted uppercase">Avaliação</dt>
          <dd className="mt-1.5 text-sm">{rating ? <Stars value={rating} /> : <span className="text-muted">—</span>}</dd>
        </div>
      </motion.dl>

      <motion.div variants={item} className="mt-4 flex flex-wrap items-center gap-1.5">
        <StatusPill status={status} label={STATUS_LABEL[status]} />
        {finished.length > 1 && (
          <span className="rounded-full border border-faint px-2 py-[3px] font-medium text-[9px] tracking-[0.2em] text-ink uppercase">
            Lido {finished.length}× · {finished.map((x) => x.year).join(", ")}
          </span>
        )}
        {book.themes.map((t) => (
          <span key={t} className="rounded-full border border-faint px-2 py-[3px] font-medium text-[9px] tracking-[0.15em] text-muted uppercase">
            {t}
          </span>
        ))}
      </motion.div>

      <motion.div variants={item} className="relative mt-6 min-h-0 flex-1">
        <div
          className="no-scrollbar h-full overflow-y-auto pr-2 pb-10"
          style={{ maskImage: "linear-gradient(180deg, black calc(100% - 48px), transparent)" }}
        >
          <h3 className="font-medium text-[10px] tracking-[0.22em] text-muted uppercase">Anotações</h3>
          {html.length === 0 && (
            <p className="mt-3 text-[15px] text-muted italic">Você ainda não fez anotações deste livro.</p>
          )}
          {html.map((n) => (
            <section key={n.label} className="mt-4">
              {html.length > 1 && <p className="mb-2 font-display text-xl text-accent italic">{n.label}</p>}
              <div className="notes text-[15px] leading-relaxed text-ink/85" dangerouslySetInnerHTML={{ __html: n.html }} />
            </section>
          ))}
        </div>
      </motion.div>

      <motion.nav
        variants={item}
        className="flex flex-wrap items-center gap-2 border-t border-faint py-4 font-medium text-[10px] tracking-[0.14em] uppercase"
      >
        <div className="flex items-center gap-2">
          <PanelButton onClick={onPrev} icon={<ArrowLeftIcon />}>
            Anterior
          </PanelButton>
          <PanelButton onClick={onNext} icon={<ArrowRightIcon />} iconAfter>
            Próximo
          </PanelButton>
        </div>
        <span className="ml-auto rounded-full border border-faint bg-[var(--surface)] px-3 py-2 text-muted tabular-nums">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <div className="flex items-center gap-2">
          <PanelButton onClick={onEdit} icon={<EditIcon />} variant="accent" aria-label={`Editar ${book.title}`}>
            Editar
          </PanelButton>
          <PanelButton onClick={onDelete} icon={<TrashIcon />} variant="danger" aria-label={`Excluir ${book.title}`}>
            Excluir
          </PanelButton>
        </div>
      </motion.nav>
    </motion.aside>
  );
}

type PanelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  iconAfter?: boolean;
  variant?: "default" | "accent" | "danger";
};

function PanelButton({ icon, iconAfter = false, variant = "default", className = "", children, ...props }: PanelButtonProps) {
  const variants = {
    default: "border-faint bg-[var(--surface)] text-muted hover:border-ink/25 hover:bg-ink/[0.05] hover:text-ink",
    accent: "border-accent/25 bg-accent/10 text-accent hover:border-accent/40 hover:bg-accent/15",
    danger: "border-[var(--ribbon)]/20 bg-[var(--ribbon)]/[0.06] text-muted hover:border-[var(--ribbon)]/35 hover:bg-[var(--ribbon)]/10 hover:text-[var(--ribbon)]",
  };

  return (
    <button
      {...props}
      className={`group inline-flex min-h-9 items-center justify-center gap-2 rounded-full border px-3.5 py-2 shadow-[0_1px_0_rgba(255,255,255,0.04)] transition-[color,background-color,border-color,transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:translate-y-0 ${variants[variant]} ${className}`}
    >
      {!iconAfter && <span className="size-3.5 shrink-0 transition-transform duration-200 group-hover:scale-110">{icon}</span>}
      <span>{children}</span>
      {iconAfter && <span className="size-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5">{icon}</span>}
    </button>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-full">
      <path d="M13 8H3m0 0 4-4M3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-full">
      <path d="M3 8h10m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-full">
      <path d="m10.75 2.75 2.5 2.5M3 13l.7-3.2 7.8-7.8a1.06 1.06 0 0 1 1.5 0l1 1a1.06 1.06 0 0 1 0 1.5l-7.8 7.8L3 13Z" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-full">
      <path d="M2.75 4.5h10.5M6 2.75h4M4.25 4.5l.55 8.1a.75.75 0 0 0 .75.7h4.9a.75.75 0 0 0 .75-.7l.55-8.1M6.5 7v3.75M9.5 7v3.75" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-[9px] tracking-[0.2em] text-muted uppercase">{label}</dt>
      <dd className="mt-1.5 text-base leading-none font-medium tabular-nums">{value}</dd>
    </div>
  );
}
