import { requireOwner } from "@/lib/server/auth";
import type { BookInput } from "@/lib/server/book-input";
import { deleteBook } from "@/lib/server/delete-book";
import { errorResponse } from "@/lib/server/respond";
import { updateBook } from "@/lib/server/update-book";

type Ctx = { params: Promise<{ id: string }> };

/** Edita um livro. */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const { supabase } = await requireOwner();
    const book = await updateBook(supabase, id, (await request.json()) as BookInput);
    return Response.json({ book });
  } catch (e) {
    return errorResponse(e, `books:update ${id}`, "Não foi possível salvar as alterações.");
  }
}

/** Exclui um livro da estante. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const { supabase } = await requireOwner();
    await deleteBook(supabase, id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e, `books:delete ${id}`, "Não foi possível excluir o livro.");
  }
}
