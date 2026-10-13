"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { newId, parseNotes, serializeNotes, type NoteChapter } from "@/lib/notes";

type Props = {
  value?: string; // Markdown inicial (usado ao editar um livro)
  onChange: (markdown: string) => void;
};

const emptyChapter = (n: number): NoteChapter => ({ id: newId(), title: `Capítulo ${n}`, items: [{ id: newId(), text: "" }] });

/** Editor visual: capítulos com uma lista de anotações. Nada de símbolos para digitar. */
export function NotesEditor({ value = "", onChange }: Props) {
  const [chapters, setChapters] = useState<NoteChapter[]>(() => {
    const parsed = parseNotes(value);
    return parsed.length ? parsed : [emptyChapter(1)];
  });
  const refs = useRef(new Map<string, HTMLTextAreaElement | HTMLInputElement>());
  // Campo que deve receber o foco assim que existir. É aplicado UMA vez e descartado —
  // senão cada tecla digitada em outro campo puxaria o cursor de volta para ele.
  const pendingFocus = useRef<string | null>(null);

  const applyFocus = () => {
    const id = pendingFocus.current;
    const el = id ? refs.current.get(id) : null;
    if (!el) return;
    pendingFocus.current = null;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  };

  const focusSoon = (id: string) => {
    pendingFocus.current = id;
    requestAnimationFrame(applyFocus); // campo que já existe (nenhuma re-renderização acontece)
  };

  // campo recém-criado: foca depois que ele entra no DOM
  useEffect(applyFocus);

  const update = (next: NoteChapter[]) => {
    setChapters(next);
    onChange(serializeNotes(next));
  };

  const setItem = (cid: string, iid: string, text: string) =>
    update(chapters.map((c) => (c.id !== cid ? c : { ...c, items: c.items.map((i) => (i.id === iid ? { ...i, text } : i)) })));

  const addItem = (cid: string, afterId?: string, text = "") => {
    const item = { id: newId(), text };
    update(
      chapters.map((c) => {
        if (c.id !== cid) return c;
        const at = afterId ? c.items.findIndex((i) => i.id === afterId) + 1 : c.items.length;
        return { ...c, items: [...c.items.slice(0, at), item, ...c.items.slice(at)] };
      })
    );
    focusSoon(item.id);
  };

  const removeItem = (cid: string, iid: string) => {
    const chapter = chapters.find((c) => c.id === cid)!;
    const idx = chapter.items.findIndex((i) => i.id === iid);
    const prev = chapter.items[idx - 1];
    update(chapters.map((c) => (c.id !== cid ? c : { ...c, items: c.items.filter((i) => i.id !== iid) })));
    focusSoon(prev ? prev.id : `title-${cid}`);
  };

  const addChapter = () => {
    const c = emptyChapter(chapters.length + 1);
    update([...chapters, c]);
    focusSoon(`title-${c.id}`);
  };

  const removeChapter = (cid: string) => update(chapters.filter((c) => c.id !== cid));

  const moveChapter = (cid: string, dir: -1 | 1) => {
    const i = chapters.findIndex((c) => c.id === cid);
    const j = i + dir;
    if (j < 0 || j >= chapters.length) return;
    const next = [...chapters];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {chapters.map((c, ci) => (
          <motion.div
            key={c.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.25 }}
            className="group/chapter rounded-md border border-faint px-4 pt-3 pb-2"
          >
            <div className="flex items-center gap-2">
              <input
                ref={(el) => {
                  if (el) refs.current.set(`title-${c.id}`, el);
                }}
                value={c.title}
                onChange={(e) => update(chapters.map((x) => (x.id === c.id ? { ...x, title: e.target.value } : x)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const first = c.items[0];
                    if (first) focusSoon(first.id);
                    else addItem(c.id);
                  }
                }}
                placeholder="Nome do capítulo (opcional)"
                className="min-w-0 flex-1 bg-transparent font-display text-xl text-ink placeholder:text-muted/50 focus:outline-none"
              />
              <div className="flex shrink-0 items-center gap-0.5 text-muted opacity-60 transition group-focus-within/chapter:opacity-100 group-hover/chapter:opacity-100">
                <IconButton label="Subir capítulo" disabled={ci === 0} onClick={() => moveChapter(c.id, -1)}>
                  ↑
                </IconButton>
                <IconButton label="Descer capítulo" disabled={ci === chapters.length - 1} onClick={() => moveChapter(c.id, 1)}>
                  ↓
                </IconButton>
                <IconButton label="Remover capítulo" onClick={() => removeChapter(c.id)}>
                  ✕
                </IconButton>
              </div>
            </div>

            <ul className="mt-1.5">
              <AnimatePresence initial={false}>
                {c.items.map((item) => (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="group/item flex items-start gap-2.5"
                  >
                    <span className="mt-[13px] h-px w-[6px] shrink-0 bg-accent" aria-hidden />
                    <AutoTextarea
                      ref={(el) => {
                        if (el) refs.current.set(item.id, el);
                        else refs.current.delete(item.id);
                      }}
                      value={item.text}
                      placeholder="Escreva uma anotação…"
                      onChange={(text) => setItem(c.id, item.id, text)}
                      onEnter={() => addItem(c.id, item.id)}
                      onBackspaceEmpty={() => removeItem(c.id, item.id)}
                      onPasteLines={(lines) => {
                        // colar várias linhas cria uma anotação por linha
                        const [first, ...rest] = lines;
                        const extra = rest.map((text) => ({ id: newId(), text }));
                        update(
                          chapters.map((x) => {
                            if (x.id !== c.id) return x;
                            const at = x.items.findIndex((i) => i.id === item.id);
                            const items = [...x.items];
                            items[at] = { ...items[at], text: (items[at].text + first).trim() };
                            items.splice(at + 1, 0, ...extra);
                            return { ...x, items };
                          })
                        );
                        if (extra.length) focusSoon(extra[extra.length - 1].id);
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Remover anotação"
                      onClick={() => removeItem(c.id, item.id)}
                      className="mt-1.5 shrink-0 px-1 text-xs text-muted opacity-0 transition group-hover/item:opacity-60 hover:!opacity-100"
                    >
                      ✕
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <button
              type="button"
              onClick={() => addItem(c.id)}
              className="mt-1 mb-1 ml-4 text-xs text-muted transition hover:text-accent"
            >
              + anotação
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={addChapter}
          className="rounded-full border border-dashed border-muted/50 px-3.5 py-2 text-[11px] font-medium tracking-[0.14em] text-muted uppercase transition hover:border-accent hover:text-ink"
        >
          + Capítulo
        </button>
        <span className="text-[11px] text-muted">Enter: nova anotação · Shift+Enter: quebra de linha</span>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-full text-xs transition hover:bg-faint hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

type AutoTextareaProps = {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  onBackspaceEmpty: () => void;
  onPasteLines: (lines: string[]) => void;
  ref?: React.Ref<HTMLTextAreaElement>;
};

/** Textarea que cresce com o texto. */
function AutoTextarea({ value, placeholder, onChange, onEnter, onBackspaceEmpty, onPasteLines, ref }: AutoTextareaProps) {
  const inner = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = el;
      }}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onEnter();
        } else if (e.key === "Backspace" && value === "") {
          e.preventDefault();
          onBackspaceEmpty();
        }
      }}
      onPaste={(e) => {
        const text = e.clipboardData.getData("text");
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
          .filter(Boolean);
        if (lines.length > 1) {
          e.preventDefault();
          onPasteLines(lines);
        }
      }}
      className="w-full resize-none overflow-hidden bg-transparent py-1 text-[15px] leading-relaxed text-ink placeholder:text-muted/50 focus:outline-none"
    />
  );
}
