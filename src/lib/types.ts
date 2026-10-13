export type ReadingStatus = "quero-ler" | "lendo" | "lido";

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  "quero-ler": "Quero ler",
  lendo: "Lendo",
  lido: "Lido",
};

/** Uma passagem pelo livro. Um mesmo livro pode ter várias (releituras). */
export type Reading = {
  year: number;
  status: ReadingStatus;
  startedAt: string | null; // ISO yyyy-mm-dd
  finishedAt: string | null;
  pagesRead: number;
  rating: number | null; // 1–5
};

export type NoteSection = {
  label: string;
  year: number;
  markdown: string;
};

export type Spine = {
  color: string;
  band: string;
  ink: string;
  width: number; // px
  height: number; // px
  binding: "capa-dura" | "brochura" | "bolso";
  finish: "tecido" | "brilho" | "fosco";
  face: "serif" | "regular" | "bold"; // serif = Instrument Serif; regular/bold = DM Sans
  caps: boolean;
  lean: number; // graus
  depth: number; // px
};

export type Book = {
  id: string;
  title: string;
  author: string;
  pages: number;
  cover: string;
  coverAspect: number; // altura / largura
  genres: string[];
  themes: string[];
  readings: Reading[];
  notes: NoteSection[];
  spine: Spine;
};

/** Um dia em que houve leitura, e (opcionalmente) quais livros. */
export type ReadingDay = {
  date: string; // AAAA-MM-DD, data local
  bookIds: string[];
};

export type Library = {
  importedAt: string;
  books: Book[];
  readingDays?: ReadingDay[];
};

/** Leitura mais recente — define o status e a avaliação exibidos. */
export const latestReading = (b: Book): Reading | undefined => b.readings[b.readings.length - 1];

export const bookStatus = (b: Book): ReadingStatus => latestReading(b)?.status ?? "quero-ler";

export const bookRating = (b: Book): number | null =>
  [...b.readings].reverse().find((r) => r.rating)?.rating ?? null;

export const bookProgress = (b: Book): number => {
  const r = latestReading(b);
  if (!r || !b.pages) return 0;
  if (r.status === "lido") return 100;
  return Math.min(100, Math.round((r.pagesRead / b.pages) * 1000) / 10);
};
