import type { SupabaseClient } from "@supabase/supabase-js";
import { NotFoundError, removeCover } from "./book-input";
import { deleteBookRow } from "./db";

export { NotFoundError } from "./book-input";

/** Remove o livro (com leituras e anotações) e apaga o arquivo da capa. */
export async function deleteBook(sb: SupabaseClient, id: string) {
  const deleted = await deleteBookRow(sb, id);
  if (!deleted) throw new NotFoundError("Livro não encontrado.");
  if (deleted.cover) await removeCover(deleted.cover);
}
