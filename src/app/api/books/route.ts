import { requireOwner } from "@/lib/server/auth";
import type { BookInput } from "@/lib/server/book-input";
import { createBook } from "@/lib/server/create-book";
import { errorResponse } from "@/lib/server/respond";

/** Cadastra um livro novo na estante. */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireOwner();
    const book = await createBook(supabase, (await request.json()) as BookInput);
    return Response.json({ book }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "books:create", "Não foi possível salvar o livro.");
  }
}
