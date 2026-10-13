/* eslint-disable @next/next/no-img-element -- texturas dentro de faces 3D; a capa já é um webp local pequeno */
import type { Book } from "@/lib/types";

const FINISH: Record<Book["spine"]["finish"], string> = {
  tecido:
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 1px, rgba(0,0,0,0.05) 1px 2px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, rgba(0,0,0,0.04) 1px 2px)",
  brilho: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 30%)",
  fosco: "repeating-linear-gradient(0deg, rgba(0,0,0,0.035) 0 2px, rgba(255,255,255,0.02) 2px 3px)",
};

const SHADE: Record<Book["spine"]["finish"], string> = {
  tecido:
    "linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.14) 22%, rgba(255,255,255,0.10) 48%, rgba(0,0,0,0.12) 76%, rgba(0,0,0,0.36) 100%)",
  brilho:
    "linear-gradient(90deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.06) 16%, rgba(255,255,255,0.30) 38%, rgba(255,255,255,0.08) 52%, rgba(0,0,0,0.14) 78%, rgba(0,0,0,0.38) 100%)",
  fosco:
    "linear-gradient(90deg, rgba(0,0,0,0.36) 0%, rgba(0,0,0,0.10) 20%, rgba(255,255,255,0.12) 46%, rgba(0,0,0,0.10) 80%, rgba(0,0,0,0.30) 100%)",
};

const surname = (author: string) => author.split(/\s+/).pop() ?? author;

const TITLE_TOP = 18;
const TITLE_BOTTOM = 36;
const MIN_SIZE = 8;

// Largura média de um caractere (em em) por estilo — usada para o título caber na lombada.
const FACE: Record<Book["spine"]["face"], { family: string; weight: number; charW: number; scale: number }> = {
  serif: { family: "var(--font-instrument)", weight: 400, charW: 0.43, scale: 1.18 },
  regular: { family: "var(--font-dm-sans)", weight: 500, charW: 0.52, scale: 1 },
  bold: { family: "var(--font-dm-sans)", weight: 700, charW: 0.56, scale: 1 },
};

/** Escolhe tamanho e nº de linhas para o título caber inteiro, centralizado na lombada. */
function fitTitle(book: Book) {
  const { spine } = book;
  const face = FACE[spine.face];
  const tracking = spine.caps ? 0.08 : 0.01;
  const perChar = face.charW * (spine.caps ? 1.18 : 1) + tracking;
  const length = (spine.height - TITLE_TOP - TITLE_BOTTOM) * 0.96;
  const needed = book.title.length * perChar; // comprimento do título em "em"
  const byWidth = Math.min(15, spine.width * 0.42) * face.scale;

  let lines: 1 | 2 = 1;
  let size = Math.min(byWidth, length / needed);
  if (size < MIN_SIZE + 1 && spine.width >= 36) {
    // lombada larga: quebra em duas colunas em vez de encolher demais
    const twoLine = Math.min((spine.width - 8) / 2.3, byWidth, (2 * length) / needed);
    if (twoLine > size) {
      lines = 2;
      size = twoLine;
    }
  }
  return { family: face.family, weight: face.weight, size: Math.max(MIN_SIZE, size), lines, tracking: `${tracking}em` };
}

/** A face da lombada. Ocupa 100% do elemento pai (largura × altura da lombada). */
export function SpineFace({ book, scale = 1 }: { book: Book; scale?: number }) {
  const { spine } = book;
  const w = spine.width;
  const t = fitTitle(book);

  return (
    <span
      className="absolute inset-0 overflow-hidden rounded-[2px]"
      style={{ backgroundColor: spine.color, color: spine.ink }}
    >
      {book.cover && (
        <img
          src={book.cover}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="pointer-events-none absolute top-0 left-0 h-full w-auto max-w-none opacity-60"
        />
      )}
      <span className="pointer-events-none absolute inset-0" style={{ backgroundColor: spine.color, opacity: 0.68 }} />
      <span
        className="pointer-events-none absolute inset-x-[3px] h-px"
        style={{ top: 12 * scale, backgroundColor: spine.band, opacity: 0.7 }}
      />
      <span
        className="pointer-events-none absolute inset-x-[3px] h-px"
        style={{ bottom: 28 * scale, backgroundColor: spine.band, opacity: 0.6 }}
      />
      {/* contêiner horizontal centraliza; só o texto fica na vertical */}
      <span
        className="absolute inset-x-0 flex items-center justify-center overflow-hidden"
        style={{ top: TITLE_TOP * scale, bottom: TITLE_BOTTOM * scale }}
      >
        <span
          className="max-h-full overflow-hidden text-center"
          style={{
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            fontFamily: t.family,
            fontSize: t.size * scale,
            fontWeight: t.weight,
            lineHeight: 1.08,
            letterSpacing: t.tracking,
            textTransform: spine.caps ? "uppercase" : "none",
            whiteSpace: t.lines === 1 ? "nowrap" : "normal",
            textOverflow: "ellipsis",
            maxWidth: t.lines === 2 ? t.size * scale * 2.3 : undefined,
            textShadow: "0 0.5px 0 rgba(0,0,0,0.35), 0 -0.5px 0 rgba(255,255,255,0.1)",
          }}
        >
          {book.title}
        </span>
      </span>
      {w >= 24 && (
        <span
          className="pointer-events-none absolute inset-x-0 flex justify-center"
          style={{ bottom: 10 * scale, opacity: 0.6 }}
        >
          <span
            className="max-w-full truncate px-0.5 font-medium uppercase"
            style={{ fontSize: 5.5 * scale, letterSpacing: "0.16em" }}
          >
            {surname(book.author)}
          </span>
        </span>
      )}
      <span className="pointer-events-none absolute inset-0" style={{ backgroundImage: FINISH[spine.finish], opacity: 0.6 }} />
      <span className="pointer-events-none absolute inset-0" style={{ backgroundImage: SHADE[spine.finish] }} />
      <span
        className="pointer-events-none absolute inset-0 rounded-[2px]"
        style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 2px 3px rgba(0,0,0,0.2)" }}
      />
    </span>
  );
}
