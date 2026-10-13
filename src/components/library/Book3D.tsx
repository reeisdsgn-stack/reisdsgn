/* eslint-disable @next/next/no-img-element -- capa aplicada como face de um objeto 3D em CSS */
import type { Book } from "@/lib/types";
import { SpineFace } from "./SpineFace";

export function bookDims(book: Book, width: number) {
  const W = width;
  const H = Math.round(W * book.coverAspect);
  const D = Math.max(10, Math.round(book.spine.width * (H / book.spine.height)));
  return { W, H, D };
}

/** Livro fechado em CSS 3D: capa, lombada, páginas, topo, base e contracapa. */
export function Book3D({ book, width }: { book: Book; width: number }) {
  const { W, H, D } = bookDims(book, width);
  const spineScale = H / book.spine.height;

  return (
    <div className="preserve-3d relative" style={{ width: W, height: H }}>
      {/* contracapa */}
      <div
        className="backface-hidden absolute inset-0 rounded-r-[3px]"
        style={{ backgroundColor: book.spine.color, transform: `translateZ(${-D / 2}px) rotateY(180deg)` }}
      />
      {/* páginas (lado direito) */}
      <div
        className="backface-hidden absolute top-[2px]"
        style={{
          left: W - D / 2 - 2,
          width: D,
          height: H - 4,
          transform: "rotateY(90deg)",
          background:
            "repeating-linear-gradient(90deg, var(--paper) 0 1px, var(--paper-2) 1px 2px), linear-gradient(90deg, rgba(0,0,0,0.15), transparent)",
          backgroundBlendMode: "multiply",
        }}
      />
      {/* topo */}
      <div
        className="backface-hidden absolute left-0"
        style={{
          top: -D / 2,
          width: W - 2,
          height: D,
          transform: "rotateX(90deg)",
          background: "repeating-linear-gradient(0deg, var(--paper) 0 1px, var(--paper-2) 1px 2px)",
        }}
      />
      {/* base */}
      <div
        className="backface-hidden absolute left-0"
        style={{ top: H - D / 2, width: W - 2, height: D, transform: "rotateX(-90deg)", background: "var(--paper-2)" }}
      />
      {/* lombada (lado esquerdo) */}
      <div
        className="backface-hidden absolute top-0"
        style={{ left: -D / 2, width: D, height: H, transform: "rotateY(-90deg)" }}
      >
        <SpineFace book={book} scale={spineScale} />
      </div>
      {/* capa */}
      <div
        className="backface-hidden absolute inset-0 overflow-hidden rounded-r-[3px]"
        style={{
          backgroundColor: book.spine.color,
          transform: `translateZ(${D / 2}px)`,
          boxShadow: "0 30px 60px -30px rgba(0,0,0,0.6)",
        }}
      >
        {book.cover && (
          <img src={book.cover} alt={`Capa de ${book.title}`} draggable={false} className="h-full w-full object-cover" />
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.28) 0%, rgba(255,255,255,0.14) 2.5%, rgba(0,0,0,0.06) 5%, transparent 9%), linear-gradient(100deg, rgba(255,255,255,0.12), transparent 40%, rgba(0,0,0,0.12))",
          }}
        />
      </div>
    </div>
  );
}
