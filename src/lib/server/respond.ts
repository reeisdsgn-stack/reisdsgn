import { UnauthorizedError } from "./auth";
import { NotFoundError, ValidationError } from "./book-input";

/** Converte erros conhecidos em respostas HTTP; o resto vira 500 com registro no log. */
export function errorResponse(e: unknown, tag: string, fallback: string) {
  if (e instanceof UnauthorizedError) return Response.json({ error: e.message }, { status: 401 });
  if (e instanceof ValidationError) return Response.json({ error: e.message }, { status: 400 });
  if (e instanceof NotFoundError) return Response.json({ error: e.message }, { status: 404 });
  console.error(`[${tag}]`, e);
  return Response.json({ error: fallback }, { status: 500 });
}
