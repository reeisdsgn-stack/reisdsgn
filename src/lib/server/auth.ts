import { createClient } from "../supabase/server";
import { getOwnerId } from "../supabase/admin";

export class UnauthorizedError extends Error {}

/**
 * Garante que quem fez o pedido está logado e é o dono da biblioteca.
 * Use em toda rota de API e página — o proxy é só a primeira barreira.
 */
export async function requireOwner() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) throw new UnauthorizedError("Faça login para continuar.");
  if (userId !== (await getOwnerId())) throw new UnauthorizedError("Acesso restrito ao dono da biblioteca.");
  return { supabase, userId };
}
