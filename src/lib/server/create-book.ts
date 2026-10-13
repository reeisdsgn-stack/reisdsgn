import type { SupabaseClient } from "@supabase/supabase-js";
import type { Book } from "../types";
import { slugify, spineGeometry } from "../spine-geometry";
import { adoptTempCover, coverName, notesFrom, readingFrom, resolveColors, validateBasics, type BookInput } from "./book-input";
import { idsStartingWith, insertBook } from "./db";

export async function createBook(sb: SupabaseClient, input: BookInput): Promise<Book> {
  const { title, author, pages, genres, themes } = validateBasics(input);

  // id único a partir do título
  const base = slugify(title) || "livro";
  const taken = new Set(await idsStartingWith(sb, base));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;

  const reading = readingFrom(input, pages, new Date().getFullYear());
  const cover = (await adoptTempCover(input.cover, coverName(id))) ?? "";

  const book: Book = {
    id,
    title,
    author,
    pages,
    cover,
    coverAspect: cover && input.coverAspect ? input.coverAspect : 1.5,
    genres,
    themes,
    readings: [reading],
    notes: notesFrom(input.notes, reading.year),
    spine: spineGeometry(id, pages, resolveColors(input, id)),
  };

  await insertBook(sb, book);
  return book;
}
