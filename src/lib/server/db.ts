import type { SupabaseClient } from "@supabase/supabase-js";
import type { Book, NoteSection, Reading, ReadingDay, Spine } from "../types";

// Linha da tabela public.books
type BookRow = {
  id: string;
  title: string;
  author: string;
  pages: number;
  cover: string;
  cover_aspect: number;
  genres: string[];
  themes: string[];
  readings: Reading[];
  notes: NoteSection[];
  spine: Spine;
};

export const toBook = (r: BookRow): Book => ({
  id: r.id,
  title: r.title,
  author: r.author,
  pages: r.pages,
  cover: r.cover,
  coverAspect: r.cover_aspect,
  genres: r.genres,
  themes: r.themes,
  readings: r.readings,
  notes: r.notes,
  spine: r.spine,
});

export const toRow = (b: Book): BookRow & { updated_at: string } => ({
  id: b.id,
  title: b.title,
  author: b.author,
  pages: b.pages,
  cover: b.cover,
  cover_aspect: b.coverAspect,
  genres: b.genres,
  themes: b.themes,
  readings: b.readings,
  notes: b.notes,
  spine: b.spine,
  updated_at: new Date().toISOString(),
});

const COLUMNS = "id, title, author, pages, cover, cover_aspect, genres, themes, readings, notes, spine";

type Result<T> = { data: T; error: { message: string } | null };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Executa a consulta e devolve os dados (ou lança o erro).
 * Logo depois do login o banco às vezes recusa o token recém-emitido
 * ("JWT issued at future") por uma fração de segundo: espera e tenta de novo.
 */
async function run<T>(query: () => PromiseLike<Result<T>>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await query();
    if (!res.error) return res.data;
    if (attempt < 3 && /issued at future/i.test(res.error.message)) {
      await wait(800 * (attempt + 1));
      continue;
    }
    throw new Error(res.error.message);
  }
}

export async function listBooks(sb: SupabaseClient): Promise<Book[]> {
  const rows = await run(() => sb.from("books").select(COLUMNS).order("created_at").order("id"));
  return (rows as BookRow[]).map(toBook);
}

export async function getBook(sb: SupabaseClient, id: string): Promise<Book | null> {
  const row = await run(() => sb.from("books").select(COLUMNS).eq("id", id).maybeSingle());
  return row ? toBook(row as BookRow) : null;
}

/** Ids que começam com o prefixo — para gerar um id novo sem repetir. */
export async function idsStartingWith(sb: SupabaseClient, prefix: string): Promise<string[]> {
  const rows = await run(() => sb.from("books").select("id").like("id", `${prefix}%`));
  return (rows as { id: string }[]).map((r) => r.id);
}

export async function insertBook(sb: SupabaseClient, book: Book) {
  await run(() => sb.from("books").insert(toRow(book)));
}

export async function updateBookRow(sb: SupabaseClient, book: Book) {
  await run(() => sb.from("books").update(toRow(book)).eq("id", book.id));
}

/** Apaga e devolve a capa do livro apagado (null se o livro não existia). */
export async function deleteBookRow(sb: SupabaseClient, id: string): Promise<{ cover: string } | null> {
  const rows = await run(() => sb.from("books").delete().eq("id", id).select("cover"));
  return (rows as { cover: string }[])[0] ?? null;
}

export async function listReadingDays(sb: SupabaseClient): Promise<ReadingDay[]> {
  const rows = await run(() => sb.from("reading_days").select("date, book_ids").order("date"));
  return (rows as { date: string; book_ids: string[] }[]).map((r) => ({ date: r.date, bookIds: r.book_ids }));
}

export async function upsertReadingDay(sb: SupabaseClient, date: string, bookIds: string[]) {
  await run(() => sb.from("reading_days").upsert({ date, book_ids: bookIds }, { onConflict: "user_id,date" }));
}

export async function deleteReadingDay(sb: SupabaseClient, date: string) {
  await run(() => sb.from("reading_days").delete().eq("date", date));
}

export async function existingBookIds(sb: SupabaseClient, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await run(() => sb.from("books").select("id").in("id", ids));
  return new Set((rows as { id: string }[]).map((r) => r.id));
}
