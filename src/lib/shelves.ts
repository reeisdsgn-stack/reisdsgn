import { bookStatus, latestReading, type Book } from "./types";

export type GroupBy = "lidos" | "ano" | "genero" | "tema" | "status";
export type SortBy = "leitura" | "titulo" | "cor" | "tamanho";

export const GROUP_LABEL: Record<GroupBy, string> = {
  lidos: "Lidos",
  ano: "Ano",
  genero: "Gênero",
  tema: "Tema",
  status: "Status",
};

export const SORT_LABEL: Record<SortBy, string> = {
  leitura: "Leitura",
  titulo: "Título",
  cor: "Cor",
  tamanho: "Tamanho",
};

export type ShelfGroup = {
  key: string;
  label: string;
  kicker?: string;
  books: Book[];
};

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function matchesQuery(book: Book, query: string) {
  const q = normalize(query.trim());
  if (!q) return true;
  return [book.title, book.author, ...book.genres, ...book.themes].some((f) => normalize(f).includes(q));
}

function hue(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const light = (max + min) / 2;
  if (d < 0.08) return 400 + light * 100; // neutros no fim, do escuro ao claro
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const readingDate = (b: Book, year?: number) => {
  const r = year ? b.readings.find((x) => x.year === year) : latestReading(b);
  return r?.finishedAt ?? r?.startedAt ?? `${r?.year ?? 0}-12-31`;
};

export function sortBooks(books: Book[], sort: SortBy, year?: number) {
  const copy = [...books];
  switch (sort) {
    case "titulo":
      return copy.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    case "cor":
      return copy.sort((a, b) => hue(a.spine.color) - hue(b.spine.color));
    case "tamanho":
      return copy.sort((a, b) => b.pages - a.pages);
    default:
      return copy.sort((a, b) => readingDate(a, year).localeCompare(readingDate(b, year)));
  }
}

const byCountThenName = (a: [string, Book[]], b: [string, Book[]]) =>
  b[1].length - a[1].length || a[0].localeCompare(b[0], "pt-BR");

export function buildShelves(books: Book[], group: GroupBy, sort: SortBy): ShelfGroup[] {
  const pages = (list: Book[]) => list.reduce((n, b) => n + b.pages, 0);
  const withMeta = (key: string, label: string, list: Book[], kicker?: string, year?: number): ShelfGroup => ({
    key,
    label,
    kicker: kicker ?? `${list.length} ${list.length === 1 ? "livro" : "livros"} · ${pages(list).toLocaleString("pt-BR")} páginas`,
    books: sortBooks(list, sort, year),
  });

  // Visão principal: uma prateleira só, com tudo o que já foi lido
  if (group === "lidos") {
    const read = books.filter((b) => b.readings.some((r) => r.status === "lido"));
    return read.length ? [withMeta("lidos", "Tudo o que já li", read)] : [];
  }

  if (group === "status") {
    const order = [
      ["lendo", "Lendo agora"],
      ["quero-ler", "Na fila"],
      ["lido", "Lidos"],
    ] as const;
    return order
      .map(([s, label]) => withMeta(s, label, books.filter((b) => bookStatus(b) === s)))
      .filter((g) => g.books.length);
  }

  if (group === "ano") {
    const years = new Map<number, Book[]>();
    const queue: Book[] = [];
    for (const b of books) {
      const read = b.readings.filter((r) => r.status !== "quero-ler");
      if (!read.length) queue.push(b);
      for (const r of read) years.set(r.year, [...(years.get(r.year) ?? []), b]);
    }
    const shelves = [...years.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([y, list]) => withMeta(String(y), String(y), list, undefined, y));
    if (queue.length) shelves.push(withMeta("fila", "Na fila", queue));
    return shelves;
  }

  const field = group === "genero" ? "genres" : "themes";
  const map = new Map<string, Book[]>();
  for (const b of books) for (const t of b[field]) map.set(t, [...(map.get(t) ?? []), b]);
  const entries = [...map.entries()].sort(byCountThenName);

  if (group === "tema") {
    // Temas com um só livro vão para uma prateleira comum
    const big = entries.filter(([, l]) => l.length >= 2);
    const loose = [...new Set(entries.filter(([, l]) => l.length < 2).flatMap(([, l]) => l))].filter(
      (b) => !big.some(([, l]) => l.includes(b))
    );
    const shelves = big.map(([t, l]) => withMeta(t, t, l));
    if (loose.length) shelves.push(withMeta("outros", "Outros temas", loose));
    return shelves;
  }

  return entries.map(([t, l]) => withMeta(t, t, l));
}
