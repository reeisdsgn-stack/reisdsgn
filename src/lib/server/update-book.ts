import type { SupabaseClient } from "@supabase/supabase-js";
import type { Book } from "../types";
import { spineGeometry } from "../spine-geometry";
import {
  adoptTempCover,
  coverName,
  notesFrom,
  NotFoundError,
  readingFrom,
  removeCover,
  resolveColors,
  validateBasics,
  type BookInput,
} from "./book-input";
import { getBook, updateBookRow } from "./db";

/**
 * Atualiza um livro. O id (e o link) não muda, mesmo se o título mudar.
 * Status, datas, páginas lidas e estrelas valem para a leitura mais recente —
 * ou para uma nova leitura, quando `newReading` (releitura).
 */
export async function updateBook(sb: SupabaseClient, id: string, input: BookInput): Promise<Book> {
  const { title, author, pages, genres, themes } = validateBasics(input);
  const current = await getBook(sb, id);
  if (!current) throw new NotFoundError("Livro não encontrado.");

  const readings = [...current.readings];
  const last = readings[readings.length - 1];
  const reading = readingFrom(input, pages, input.newReading || !last ? new Date().getFullYear() : last.year);
  if (input.newReading || !last) readings.push(reading);
  else readings[readings.length - 1] = reading;
  readings.sort((a, b) => a.year - b.year);

  const newCover = await adoptTempCover(input.cover, coverName(id));
  if (newCover && current.cover) await removeCover(current.cover);

  const notes = input.notes === undefined ? current.notes : notesFrom(input.notes, reading.year);

  const book: Book = {
    ...current,
    title,
    author,
    pages,
    genres,
    themes,
    readings,
    notes: notes.sort((a, b) => b.year - a.year),
    cover: newCover ?? current.cover,
    coverAspect: newCover && input.coverAspect ? input.coverAspect : current.coverAspect,
    spine: spineGeometry(id, pages, resolveColors(input, id, current.spine)),
  };

  await updateBookRow(sb, book);
  return book;
}
