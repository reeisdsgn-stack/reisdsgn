"use client";

import { motion } from "motion/react";
import type { Book } from "@/lib/types";
import { bookProgress, latestReading } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { Book3D, bookDims } from "./Book3D";

export const HERO_TILT = 26;
const WIDTH = 150;

type Props = {
  books: Book[];
  hiddenId: string | null;
  onOpen: (book: Book, el: HTMLElement) => void;
};

export function NowReading({ books, hiddenId, onOpen }: Props) {
  if (!books.length) return null;
  return (
    <section className="relative mx-auto max-w-6xl px-6">
      <div className="mb-8 flex items-center gap-4">
        <span className="h-px flex-1 bg-faint" />
        <h2 className="font-medium text-[10px] tracking-[0.26em] text-muted uppercase">Lendo agora</h2>
        <span className="h-px flex-1 bg-faint" />
      </div>
      {/* celular: fileira com rolagem; desktop: centralizado */}
      <div
        className="no-scrollbar -mx-6 flex snap-x snap-mandatory items-end gap-x-10 overflow-x-auto px-6 pb-2 sm:mx-0 sm:flex-wrap sm:gap-x-16 sm:gap-y-12 sm:overflow-visible sm:px-0"
        style={{ perspective: "1600px", justifyContent: "safe center" }}
      >
        {books.map((book, i) => (
          <HeroBook key={book.id} book={book} index={i} hidden={hiddenId === book.id} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function HeroBook({
  book,
  index,
  hidden,
  onOpen,
}: {
  book: Book;
  index: number;
  hidden: boolean;
  onOpen: Props["onOpen"];
}) {
  const { W, H } = bookDims(book, WIDTH);
  const r = latestReading(book);
  const progress = bookProgress(book);

  return (
    <motion.div
      className="flex w-[200px] shrink-0 snap-center flex-col items-center"
      initial={{ opacity: 0, x: 80 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 1, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* altura fixa: as bases dos livros ficam alinhadas */}
      <div className="flex h-[250px] items-end">
        <button
          type="button"
          data-cover-id={book.id}
          aria-label={`${book.title}, de ${book.author}`}
          onClick={(e) => onOpen(book, e.currentTarget)}
          className="group preserve-3d relative cursor-pointer outline-none"
          style={{ width: W, height: H, perspective: "1200px", opacity: hidden ? 0 : 1, transition: "opacity 200ms" }}
        >
          <span
            className="preserve-3d absolute inset-0 block [--hr:26deg] [--hy:0px] group-hover:[--hr:8deg] group-hover:[--hy:-10px] group-focus-visible:[--hr:8deg]"
            style={{
              transform: "translateY(var(--hy)) rotateY(var(--hr))",
              transition: "transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          >
            <Book3D book={book} width={W} />
          </span>
          <span
            className="pointer-events-none absolute -bottom-3 left-1/2 h-6 w-[110%] -translate-x-1/2 rounded-[50%] bg-black/40 blur-md"
            aria-hidden
          />
        </button>
      </div>
      <p className="mt-7 text-center font-display text-2xl leading-[1.05]">{book.title}</p>
      <p className="mt-1 font-medium text-[10px] tracking-[0.2em] text-muted uppercase">{book.author}</p>
      <div className="mt-3 h-[3px] w-40 overflow-hidden rounded-full bg-faint">
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          whileInView={{ width: `${progress}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.5 + index * 0.15, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <p className="mt-2 font-medium text-[10px] tracking-[0.12em] text-muted">
        {formatNumber(r?.pagesRead ?? 0)}/{formatNumber(book.pages)} · {formatPercent(progress)}
      </p>
    </motion.div>
  );
}
