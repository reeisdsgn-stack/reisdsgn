import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "./env";

/**
 * Cliente com a chave secreta: ignora as regras de acesso.
 * Só no servidor e só depois de confirmar que quem pediu é o dono.
 */
export function createAdminClient(): SupabaseClient {
  return createClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let ownerId: string | null = null;

/** O dono é o primeiro (e único) usuário criado. Guardado em memória depois de achado. */
export async function getOwnerId(): Promise<string | null> {
  if (ownerId) return ownerId;
  const { data, error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 50 });
  if (error) throw error;
  const first = [...data.users].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  ownerId = first?.id ?? null;
  return ownerId;
}
