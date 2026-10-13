"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Book } from "@/lib/types";
import { bookProgress, bookRating, bookStatus, latestReading, STATUS_LABEL } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { Stars } from "./Stars";
import { StatusPill } from "./StatusPill";

export type HoverState = { book: Book; x: number; y: number } | null;

export function BookTooltip({ hover }: { hover: HoverState }) {
  return (
    <AnimatePresence>
      {hover && (
        <motion.div
          key={hover.book.id}
          role="tooltip"
          className="pointer-events-none fixed z-40 w-64"
          style={{ left: hover.x, top: hover.y }}
          initial={{ opacity: 0, y: 6, x: "-50%", scale: 0.97 }}
          animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
          exit={{ opacity: 0, y: 4, x: "-50%", transition: { duration: 0.12 } }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <TooltipBody book={hover.book} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TooltipBody({ book }: { book: Book }) {
  const status = bookStatus(book);
  const rating = bookRating(book);
  const r = latestReading(book);
  const progress = bookProgress(book);
  const times = book.readings.filter((x) => x.status === "lido").length;

  return (
    <div className="-translate-y-full rounded-md border border-faint bg-panel p-4 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <p className="font-display text-2xl leading-[1.05]">{book.title}</p>
      <p className="mt-1.5 font-medium text-[10px] tracking-[0.2em] text-muted uppercase">{book.author}</p>
      <div className="mt-3 flex items-center gap-2">
        <StatusPill status={status} label={STATUS_LABEL[status]} />
        {rating && <Stars value={rating} className="text-[11px]" />}
        {times > 1 && <span className="font-medium text-[10px] tracking-[0.15em] text-muted">LIDO {times}×</span>}
      </div>
      {status === "lendo" && r && (
        <div className="mt-3">
          <div className="h-[3px] overflow-hidden rounded-full bg-faint">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 font-medium text-[10px] tracking-[0.12em] text-muted">
            {formatNumber(r.pagesRead)} de {formatNumber(book.pages)} páginas · {formatPercent(progress)}
          </p>
        </div>
      )}
      {status !== "lendo" && (
        <p className="mt-2.5 font-medium text-[10px] tracking-[0.12em] text-muted">
          {formatNumber(book.pages)} páginas{book.genres[0] ? ` · ${book.genres.join(" / ")}` : ""}
        </p>
      )}
    </div>
  );
}
