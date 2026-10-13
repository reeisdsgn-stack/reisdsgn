import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReadingDay } from "../types";
import { ValidationError } from "./book-input";
import { deleteReadingDay, existingBookIds, listReadingDays, upsertReadingDay } from "./db";

export type ReadingDayInput = {
  date: string;
  read: boolean;
  bookIds?: string[];
};

/** Marca ou desmarca um dia de leitura. Devolve a lista completa, em ordem. */
export async function setReadingDay(sb: SupabaseClient, { date, read, bookIds }: ReadingDayInput): Promise<ReadingDay[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new ValidationError("Data inválida.");
  if (read) {
    const requested = [...new Set(bookIds ?? [])];
    const known = await existingBookIds(sb, requested);
    await upsertReadingDay(sb, date, requested.filter((id) => known.has(id)));
  } else {
    await deleteReadingDay(sb, date);
  }
  return listReadingDays(sb);
}
