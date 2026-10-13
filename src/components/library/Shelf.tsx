"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Book } from "@/lib/types";
import { bookStatus } from "@/lib/types";
import type { ShelfGroup } from "@/lib/shelves";
import { SpineFace } from "./SpineFace";

type Props = {
  group: ShelfGroup;
  index: number;
  hiddenId: string | null;
  onHover: (book: Book | null, el?: HTMLElement) => void;
  onOpen: (book: Book, el: HTMLElement) => void;
};

export function Shelf({ group, index, hiddenId, onHover, onOpen }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const drag = useRef({ active: false, moved: false, startX: 0, startScroll: 0 });

  // Mostra as setas/esmaecimento só quando há livros escondidos naquele lado.
  const updateOverflow = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;
    setOverflow((o) => {
      const next = { left: row.scrollLeft > 4, right: row.scrollLeft < max - 4 };
      return o.left === next.left && o.right === next.right ? o : next;
    });
  }, []);

  useLayoutEffect(() => {
    updateOverflow();
  });

  // Enquanto rola, os livros não reagem ao cursor (data-scrolling, ver globals.css):
  // sem isso, cada livro que passa sob o mouse sobe, desce e pisca o cartão.
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const markScrolling = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    if (!("scrolling" in row.dataset)) {
      row.dataset.scrolling = "";
      onHover(null);
    }
    clearTimeout(idle.current);
    idle.current = setTimeout(() => delete row.dataset.scrolling, 180);
  }, [onHover]);
  useEffect(() => () => clearTimeout(idle.current), []);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let frame = 0;
    const onResize = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          updateOverflow();
        });
    };
    const onScroll = () => {
      markScrolling();
      onResize();
    };
    row.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      row.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [updateOverflow, markScrolling]);

  // Roda do mouse rola os livros na horizontal, com suavização.
  // Nas pontas da prateleira a roda volta a rolar a página.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let target = row.scrollLeft;
    let raf = 0;

    const step = () => {
      const cur = row.scrollLeft;
      const diff = target - cur;
      if (Math.abs(diff) < 1) {
        row.scrollLeft = target;
        raf = 0;
        return;
      }
      row.scrollLeft = cur + (Math.abs(diff) < 4 ? Math.sign(diff) * 2 : diff * 0.16);
      raf = requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      // gesto horizontal do trackpad já rola nativamente
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.ctrlKey) return;
      const max = row.scrollWidth - row.clientWidth;
      if (max <= 0) return;
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? row.clientWidth : 1;
      const delta = e.deltaY * unit;
      const base = raf ? target : row.scrollLeft;
      if ((delta < 0 && base <= 0) || (delta > 0 && base >= max)) return;
      e.preventDefault();
      markScrolling();
      target = Math.max(0, Math.min(max, base + delta * 1.2));
      if (!raf) raf = requestAnimationFrame(step);
    };

    row.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      row.removeEventListener("wheel", onWheel);
    };
  }, [markScrolling]);

  // Arrastar com o mouse para rolar
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !rowRef.current) return;
    drag.current = { active: true, moved: false, startX: e.clientX, startScroll: rowRef.current.scrollLeft };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active || !rowRef.current) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > 6) d.moved = true;
    if (d.moved) {
      markScrolling();
      rowRef.current.scrollLeft = d.startScroll - dx;
    }
  };
  const endDrag = () => {
    drag.current.active = false;
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      drag.current.moved = false;
    }
  };

  const scrollBy = (dir: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;
    markScrolling();
    row.scrollBy({ left: dir * row.clientWidth * 0.6, behavior: "smooth" });
  };

  const mask =
    overflow.left || overflow.right
      ? `linear-gradient(90deg, ${overflow.left ? "transparent, black 72px" : "black"}, ${overflow.right ? "black calc(100% - 72px), transparent" : "black"})`
      : undefined;

  return (
    <motion.section
      className="relative"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}
      transition={{ duration: 0.7, delay: 0.08 * index, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-center">
        <h2 className="font-display text-4xl italic sm:text-5xl">{group.label}</h2>
        <span className="font-medium text-[10px] tracking-[0.2em] text-muted uppercase">{group.kicker}</span>
      </header>

      <div className="relative mx-auto max-w-6xl">
        <div
          ref={rowRef}
          className="no-scrollbar preserve-3d flex items-end overflow-x-auto px-6 pt-14 pb-16 select-none"
          style={{
            justifyContent: "safe center",
            perspective: "1400px",
            // ponto de vista na linha da base dos livros (pb-16 + frente 26 + tampo visível 14 = 104px):
            // as bases ficam alinhadas no tampo mesmo com os livros girados
            perspectiveOrigin: "50% calc(100% - 112px)",
            maskImage: mask,
            WebkitMaskImage: mask,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={() => {
            endDrag();
            onHover(null);
          }}
          onClickCapture={onClickCapture}
        >
          {/* a tábua acompanha a largura da fileira */}
          <div className="preserve-3d relative flex shrink-0 flex-col" style={{ minWidth: "min(100%, 560px)" }}>
            <div className="shelf-wall-shadow" aria-hidden />
            <div className="preserve-3d relative z-[1] flex items-end justify-center gap-[3px] px-10">
              <AnimatePresence mode="popLayout" initial={false}>
                {group.books.map((book, i) => (
                  <motion.div
                    key={book.id}
                    layout="position"
                    className="preserve-3d shrink-0"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30, transition: { duration: 0.25 } }}
                    transition={{
                      layout: { type: "spring", stiffness: 260, damping: 30 },
                      default: { duration: 0.6, delay: Math.min(i * 0.025, 0.6), ease: [0.16, 1, 0.3, 1] },
                    }}
                  >
                    <ShelfBook book={book} hidden={hiddenId === book.id} onHover={onHover} onOpen={onOpen} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="shelf" aria-hidden>
              <div className="shelf-top" />
              <div className="shelf-front" />
            </div>
          </div>
        </div>

        {overflow.left && (
          <button
            aria-label="Rolar para a esquerda"
            onClick={() => scrollBy(-1)}
            className="absolute top-1/2 left-1 z-10 grid size-9 place-items-center rounded-full border border-faint bg-panel text-ink backdrop-blur transition hover:scale-105"
          >
            ‹
          </button>
        )}
        {overflow.right && (
          <button
            aria-label="Rolar para a direita"
            onClick={() => scrollBy(1)}
            className="absolute top-1/2 right-1 z-10 grid size-9 place-items-center rounded-full border border-faint bg-panel text-ink backdrop-blur transition hover:scale-105"
          >
            ›
          </button>
        )}
      </div>
    </motion.section>
  );
}

function ShelfBook({
  book,
  hidden,
  onHover,
  onOpen,
}: {
  book: Book;
  hidden: boolean;
  onHover: Props["onHover"];
  onOpen: Props["onOpen"];
}) {
  const { spine } = book;
  const reading = bookStatus(book) === "lendo";

  return (
    <button
      type="button"
      data-spine-id={book.id}
      aria-label={`${book.title}, de ${book.author}`}
      className="group preserve-3d relative block shrink-0 cursor-pointer rounded-[2px] outline-none"
      style={{
        width: spine.width,
        height: spine.height,
        opacity: hidden ? 0 : 1,
        transition: "opacity 200ms",
      }}
      onPointerEnter={(e) => !e.currentTarget.closest("[data-scrolling]") && onHover(book, e.currentTarget)}
      onFocus={(e) => onHover(book, e.currentTarget)}
      onBlur={() => onHover(null)}
      onClick={(e) => onOpen(book, e.currentTarget)}
    >
      {/* sombra de contato no tampo — fica na prateleira quando o livro sobe */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-x-1 -bottom-[7px] h-3 rounded-[50%] opacity-80 blur-[3px] transition-opacity duration-500 group-hover:opacity-35"
        style={{
          background: "radial-gradient(closest-side, rgba(0,0,0,0.55), transparent)",
          transform: "translateZ(11px)", // logo atrás do livro (12px), para rolar junto com ele
        }}
      />
      <span
        className="preserve-3d absolute inset-0 origin-bottom [--ty:0px] [--tz:12px] group-hover:[--ty:-22px] group-hover:[--tz:64px] group-focus-visible:[--ty:-22px] group-focus-visible:[--tz:64px]"
        style={{
          // 12px: a cena 3D ordena por profundidade (não por z-index), então todo livro fica à frente do tampo.
          // Mesma profundidade para todos: com a perspectiva na fileira, profundidades diferentes
          // rolariam em velocidades diferentes e os livros escorregariam uns sobre os outros.
          transform: `rotateZ(${spine.lean}deg) translateZ(var(--tz)) translateY(var(--ty))`,
          transition: "transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {/* fitinha marcadora dos livros em leitura */}
        {reading && (
          <span
            className="absolute"
            style={{
              left: "28%",
              top: -16,
              width: 5,
              height: 30,
              background: "var(--ribbon)",
              clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)",
              boxShadow: "inset -1px 0 0 rgba(0,0,0,0.25)",
            }}
          />
        )}
        <span
          className="absolute inset-0 rounded-[2px] shadow-[0_10px_22px_-14px_rgba(0,0,0,0.7)] transition-shadow duration-500 group-hover:shadow-[0_28px_40px_-20px_rgba(0,0,0,0.75)]"
        >
          <SpineFace book={book} />
        </span>
      </span>
    </button>
  );
}
