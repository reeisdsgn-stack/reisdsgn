/* eslint-disable @next/next/no-img-element -- miniaturas de resultados externos e capa recém-enviada */
"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Book, NoteSection, ReadingStatus } from "@/lib/types";
import { latestReading, STATUS_LABEL } from "@/lib/types";
import { inkFor, slugify, spineGeometry, type SpineColors } from "@/lib/spine-geometry";
import type { SearchResult } from "@/app/api/search/route";
import { lockScroll } from "@/lib/scroll-lock";
import { SpineFace } from "./SpineFace";
import { NotesEditor } from "./NotesEditor";

type CoverState = { cover: string; coverAspect: number; colors: SpineColors };

type Props = {
  book?: Book; // presente = edição
  onClose: () => void;
  onSaved: (book: Book) => void;
  genres: string[];
  themes: string[];
};

const DEFAULT_COLORS: SpineColors = { color: "#5b4a7a", band: "#c9a26b", ink: "#f7f2e8" };
const STATUS_TOKEN: Record<ReadingStatus, string> = { lendo: "lendo", lido: "lido", "quero-ler": "fila" };
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Fotos grandes (celular) passam do limite de envio do servidor (4,5 MB na Vercel):
 * reduz para 1600px no lado maior antes de mandar. Se o navegador não ler o formato, manda como está.
 */
async function shrinkImage(file: File): Promise<File> {
  if (file.size <= 3_500_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    return blob ? new File([blob], "capa.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

const label = "text-[10px] font-medium tracking-[0.2em] text-muted uppercase";
const field =
  "w-full rounded-md border border-faint bg-transparent px-3 py-2.5 text-[15px] text-ink transition-colors placeholder:text-muted/60 focus:border-accent focus:outline-none";

/** Formulário de livro: cadastro (sem `book`) ou edição (com `book`). */
export function BookFormSheet({ book, onClose, onSaved, genres, themes }: Props) {
  const editing = !!book;
  const last = book ? latestReading(book) : undefined;
  const thisYear = new Date().getFullYear();

  // busca
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState(""); // termo da última busca concluída

  // livro
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [pages, setPages] = useState(book ? String(book.pages) : "");
  const [status, setStatus] = useState<ReadingStatus>(last?.status ?? "lendo");
  const [pagesRead, setPagesRead] = useState(last?.status === "lendo" && last.pagesRead ? String(last.pagesRead) : "");
  const [startedAt, setStartedAt] = useState(last?.startedAt ?? today());
  const [finishedAt, setFinishedAt] = useState(last?.finishedAt ?? today());
  const [rating, setRating] = useState(last?.rating ?? 0);
  const [genreSel, setGenreSel] = useState<string[]>(book?.genres ?? []);
  const [themeSel, setThemeSel] = useState<string[]>(book?.themes ?? []);
  const [newReading, setNewReading] = useState(false); // releitura

  // anotações: uma seção por leitura (livros relidos têm várias)
  const [sections, setSections] = useState<NoteSection[]>(() =>
    book?.notes.length ? book.notes : [{ label: "Anotações", year: last?.year ?? thisYear, markdown: "" }]
  );
  const [activeSection, setActiveSection] = useState(0);

  // capa e lombada
  const [cover, setCover] = useState<CoverState | null>(() =>
    book?.cover
      ? { cover: book.cover, coverAspect: book.coverAspect, colors: { color: book.spine.color, band: book.spine.band, ink: book.spine.ink } }
      : null
  );
  const [coverChanged, setCoverChanged] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [spineColor, setSpineColor] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Busca com espera (debounce) e cancelamento da anterior
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results);
        setSearchedFor(q);
      } catch {
        /* cancelada ou sem rede */
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // Esc fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  // página não rola por trás enquanto o formulário existe
  useEffect(() => lockScroll(), []);

  async function uploadCover(input: File | string) {
    setCoverBusy(true);
    setError(null);
    try {
      let res: Response;
      if (typeof input === "string") {
        res = await fetch("/api/covers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input }),
        });
      } else {
        const fd = new FormData();
        fd.set("file", await shrinkImage(input));
        res = await fetch("/api/covers", { method: "POST", body: fd });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar a capa.");
      setCover(data as CoverState);
      setCoverChanged(true);
      setSpineColor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar a capa.");
    } finally {
      setCoverBusy(false);
    }
  }

  function pick(r: SearchResult) {
    setTitle(r.title);
    setAuthor(r.author);
    if (r.pages) setPages(String(r.pages));
    setResults([]);
    setQuery("");
    if (r.cover) uploadCover(r.cover);
  }

  function onFiles(files: FileList | null) {
    const f = files?.[0];
    if (f && f.type.startsWith("image/")) uploadCover(f);
  }

  // Releitura: nova leitura com status "Lendo" e uma seção nova de anotações; a anterior fica guardada
  function toggleNewReading(on: boolean) {
    setNewReading(on);
    if (on) {
      setStatus("lendo");
      setStartedAt(today());
      setPagesRead("");
      setRating(0);
      setSections((prev) => {
        const renamed = prev.map((s) => (s.label === "Anotações" && last ? { ...s, label: `Leitura de ${last.year}` } : s));
        return [{ label: `Leitura de ${thisYear}`, year: thisYear, markdown: "" }, ...renamed];
      });
      setActiveSection(0);
    } else {
      setStatus(last?.status ?? "lido");
      setStartedAt(last?.startedAt ?? today());
      setFinishedAt(last?.finishedAt ?? today());
      setPagesRead(last?.status === "lendo" && last.pagesRead ? String(last.pagesRead) : "");
      setRating(last?.rating ?? 0);
      setSections(book?.notes.length ? book.notes : [{ label: "Anotações", year: last?.year ?? thisYear, markdown: "" }]);
      setActiveSection(0);
    }
  }

  const colors = useMemo<SpineColors>(() => {
    // edição sem capa nova: parte das cores atuais da lombada
    const base = cover?.colors ?? (book ? { color: book.spine.color, band: book.spine.band, ink: book.spine.ink } : DEFAULT_COLORS);
    return spineColor ? { ...base, color: spineColor, ink: inkFor(spineColor) } : base;
  }, [book, cover, spineColor]);

  const preview = useMemo(() => {
    const id = book?.id ?? (slugify(title) || "novo-livro"); // mesmo id do servidor = mesmas variações
    return {
      id,
      title: title || "Título do livro",
      author: author || "Autor",
      pages: Number(pages) || 200,
      cover: cover?.cover ?? "",
      coverAspect: cover?.coverAspect ?? 1.5,
      genres: [],
      themes: [],
      readings: [],
      notes: [],
      spine: spineGeometry(id, Number(pages) || 200, colors),
    } satisfies Book;
  }, [book, title, author, pages, cover, colors]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !author.trim() || !(Number(pages) > 0)) {
      setError("Preencha título, autor e número de páginas.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(book ? `/api/books/${encodeURIComponent(book.id)}` : "/api/books", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          pages: Number(pages),
          status,
          pagesRead: Number(pagesRead) || 0,
          startedAt: status === "quero-ler" ? null : startedAt,
          finishedAt: status === "lido" ? finishedAt : null,
          rating: status === "lido" ? rating || null : null,
          genres: genreSel,
          themes: themeSel,
          // livro novo: texto único; edição: uma seção por leitura
          notes: editing ? sections : sections[0]?.markdown ?? "",
          cover: coverChanged ? cover?.cover : null,
          coverAspect: coverChanged ? cover?.coverAspect : undefined,
          colors: coverChanged ? cover?.colors : null,
          spineColor,
          newReading,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar.");
      onSaved(data.book as Book);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70]"
      onPaste={(e) => {
        const img = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
        if (img) uploadCover(img);
      }}
    >
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !saving && onClose()}
      />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Editar livro" : "Adicionar livro"}
        className="absolute inset-y-0 right-0 flex w-full max-w-[620px] flex-col border-l border-faint bg-bg shadow-[-30px_0_80px_-30px_rgba(0,0,0,0.5)]"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 34 }}
      >
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-faint px-7 pt-7 pb-5">
            <div>
              <p className={label}>Estante</p>
              <h2 className="mt-1 font-display text-4xl">{editing ? "Editar livro" : "Novo livro"}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-faint px-3 py-1.5 text-[10px] font-medium tracking-[0.2em] uppercase transition hover:bg-faint"
            >
              Fechar ✕
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-7 py-6">
            {/* 1. busca */}
            <section>
              <label className={label} htmlFor="book-search">
                {editing ? "Buscar outra capa ou dados" : "Buscar por título, autor ou ISBN"}
              </label>
              <div className="relative mt-2">
                <input
                  id="book-search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (e.target.value.trim().length < 2) setResults([]);
                  }}
                  placeholder="Ex.: O Pequeno Príncipe ou 9788543108681"
                  className={field}
                  autoComplete="off"
                  autoFocus={!editing}
                />
                {searching && (
                  <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-muted">buscando…</span>
                )}
              </div>
              {results.length > 0 && (
                <ul className="mt-2 max-h-72 divide-y divide-faint overflow-y-auto rounded-md border border-faint">
                  {results.map((r) => (
                    <li key={r.key}>
                      <button
                        type="button"
                        onClick={() => pick(r)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-faint"
                      >
                        <span className="h-14 w-10 shrink-0 overflow-hidden rounded-[2px] bg-faint">
                          {r.cover && <img src={r.cover.replace("-L.jpg", "-S.jpg")} alt="" className="h-full w-full object-cover" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{r.title}</span>
                          <span className="block truncate text-xs text-muted">
                            {[r.author, r.year, r.pages && `${r.pages} p.`].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-[9px] font-medium tracking-[0.15em] text-muted uppercase">
                          {r.source}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!searching && results.length === 0 && searchedFor && searchedFor === query.trim() && (
                <p className="mt-2 text-sm text-muted">Nenhum resultado para “{searchedFor}”. Preencha os campos abaixo.</p>
              )}
              <p className="mt-2 text-xs text-muted">Escolha um resultado para preencher os dados e a capa — ou preencha tudo à mão.</p>
            </section>

            {/* 2. capa e lombada */}
            <section className="grid grid-cols-[150px_1fr] gap-6">
              <div>
                <p className={label}>Capa</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onFiles(e.dataTransfer.files);
                  }}
                  className="relative mt-2 flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-[3px] border border-dashed border-muted/50 text-center text-xs text-muted transition hover:border-accent"
                >
                  {cover ? (
                    <img src={cover.cover} alt="Capa" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="px-3 leading-relaxed">
                      Clique, arraste
                      <br />
                      ou cole (⌘V)
                      <br />a imagem
                    </span>
                  )}
                  {coverBusy && (
                    <span className="absolute inset-0 grid place-items-center bg-bg/70 text-xs backdrop-blur-sm">
                      processando…
                    </span>
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFiles(e.target.files)}
                />
              </div>

              <div className="flex flex-col">
                <p className={label}>Lombada na estante</p>
                <div className="mt-2 flex flex-1 flex-col justify-end rounded-md border border-faint px-4 pt-4">
                  <div className="relative z-[1] flex items-end justify-center" style={{ height: 250 }}>
                    <div
                      className="relative shrink-0 origin-bottom"
                      style={{
                        width: preview.spine.width,
                        height: preview.spine.height,
                        transform: `scale(${Math.min(1, 240 / preview.spine.height)})`,
                      }}
                    >
                      <span className="absolute inset-0 rounded-[2px] shadow-[0_10px_22px_-14px_rgba(0,0,0,0.7)]">
                        <SpineFace book={preview} />
                      </span>
                    </div>
                  </div>
                  <div className="shelf -mx-4 mt-0" aria-hidden>
                    <div className="shelf-top" style={{ height: 18 }} />
                    <div className="shelf-front" style={{ height: 14 }} />
                  </div>
                  <div className="h-5" />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="color"
                      value={colors.color}
                      onChange={(e) => setSpineColor(e.target.value)}
                      className="size-7 cursor-pointer rounded border border-faint bg-transparent"
                    />
                    Cor da lombada
                  </label>
                  {spineColor && (
                    <button type="button" onClick={() => setSpineColor(null)} className="text-xs text-accent underline-offset-2 hover:underline">
                      usar a cor da capa
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* 3. dados */}
            <section className="grid grid-cols-6 gap-x-4 gap-y-5">
              <Field className="col-span-6" label="Título *">
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} required />
              </Field>
              <Field className="col-span-4" label="Autor *">
                <input value={author} onChange={(e) => setAuthor(e.target.value)} className={field} required />
              </Field>
              <Field className="col-span-2" label="Páginas *">
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  className={field}
                  required
                />
              </Field>

              <div className="col-span-6">
                <p className={label}>Status</p>
                <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Status">
                  {(["quero-ler", "lendo", "lido"] as ReadingStatus[]).map((s) => {
                    const t = STATUS_TOKEN[s];
                    const active = status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setStatus(s)}
                        className="flex items-center gap-2 rounded-full border px-3.5 py-2 text-[11px] font-medium tracking-[0.14em] uppercase transition"
                        style={
                          active
                            ? { color: `var(--st-${t}-fg)`, backgroundColor: `var(--st-${t}-bg)`, borderColor: `var(--st-${t}-bd)` }
                            : { color: "var(--muted)", borderColor: "var(--faint)" }
                        }
                      >
                        <span className="size-[6px] rounded-full" style={{ backgroundColor: `var(--st-${t}-fg)` }} />
                        {STATUS_LABEL[s]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {editing && last?.status === "lido" && (
                <div className="col-span-6 -mt-1 rounded-md border border-dashed border-faint px-4 py-3 text-sm">
                  {newReading ? (
                    <span className="text-muted">
                      Nova leitura de {thisYear}. A leitura de {last.year} fica guardada.{" "}
                      <button type="button" onClick={() => toggleNewReading(false)} className="text-accent underline-offset-2 hover:underline">
                        desfazer
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => toggleNewReading(true)} className="text-accent underline-offset-2 hover:underline">
                      ↻ Estou relendo este livro — registrar uma nova leitura
                    </button>
                  )}
                </div>
              )}

              {status !== "quero-ler" && (
                <Field className="col-span-3" label="Data de início">
                  <input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className={field} />
                </Field>
              )}
              {status === "lido" && (
                <Field className="col-span-3" label="Data de término">
                  <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} className={field} />
                </Field>
              )}
              {status === "lendo" && (
                <Field className="col-span-3" label="Páginas lidas">
                  <input
                    type="number"
                    min={0}
                    max={Number(pages) || undefined}
                    inputMode="numeric"
                    value={pagesRead}
                    onChange={(e) => setPagesRead(e.target.value)}
                    className={field}
                  />
                </Field>
              )}
              {status === "lido" && (
                <div className="col-span-6">
                  <p className={label}>Avaliação</p>
                  <StarsInput value={rating} onChange={setRating} />
                </div>
              )}

              <div className="col-span-6">
                <TagInput label="Gêneros" value={genreSel} onChange={setGenreSel} suggestions={genres} />
              </div>
              <div className="col-span-6">
                <TagInput label="Temas" value={themeSel} onChange={setThemeSel} suggestions={themes} />
              </div>

              <div className="col-span-6">
                <p className={label}>Anotações</p>
                {sections.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sections.map((sec, i) => (
                      <button
                        key={sec.label + i}
                        type="button"
                        onClick={() => setActiveSection(i)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          i === activeSection ? "border-accent text-ink" : "border-faint text-muted hover:text-ink"
                        }`}
                      >
                        {sec.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2">
                  <NotesEditor
                    key={`${activeSection}-${sections.length}`}
                    value={sections[activeSection]?.markdown ?? ""}
                    onChange={(md) =>
                      setSections((prev) => prev.map((sec, i) => (i === activeSection ? { ...sec, markdown: md } : sec)))
                    }
                  />
                </div>
              </div>
            </section>
          </div>

          <footer className="flex items-center gap-3 border-t border-faint px-7 py-4">
            {error && <p className="mr-auto text-sm text-[var(--ribbon)]">{error}</p>}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-full px-4 py-2.5 text-[11px] font-medium tracking-[0.18em] text-muted uppercase transition hover:text-ink"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || coverBusy}
              className="rounded-full bg-accent px-5 py-2.5 text-[11px] font-medium tracking-[0.18em] text-accent-ink uppercase transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Guardando…" : editing ? "Salvar alterações" : "Adicionar à estante"}
            </button>
          </footer>
        </form>
      </motion.aside>
    </div>
  );
}

function Field({ label: text, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className={label}>{text}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function StarsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="mt-2 flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n === value ? 0 : n)}
          className={`text-2xl leading-none transition-transform hover:scale-110 ${n <= shown ? "text-accent" : "text-faint"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function TagInput({
  label: text,
  value,
  onChange,
  suggestions,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
}) {
  const [draft, setDraft] = useState("");
  const add = (t: string) => {
    const tag = t.trim();
    if (tag && !value.some((v) => v.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft("");
  };
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const options = suggestions.filter((s) => !value.includes(s) && norm(s).includes(norm(draft))).slice(0, 10);

  return (
    <div>
      <p className={label}>{text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-faint px-2 py-2 focus-within:border-accent">
        {value.map((t) => (
          <span key={t} className="flex items-center gap-1 rounded-full bg-faint px-2.5 py-1 text-xs">
            {t}
            <button type="button" aria-label={`Remover ${t}`} onClick={() => onChange(value.filter((v) => v !== t))} className="text-muted hover:text-ink">
              ✕
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length ? "" : "Digite e pressione Enter"}
          className="min-w-32 flex-1 bg-transparent px-1 py-0.5 text-[15px] placeholder:text-muted/60 focus:outline-none"
        />
      </div>
      {options.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {options.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-faint px-2.5 py-1 text-xs text-muted transition hover:border-accent hover:text-ink"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
