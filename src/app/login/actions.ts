"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient, getOwnerId } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { setupSecret } from "@/lib/supabase/env";

export type AuthState = { error?: string } | undefined;

const field = (fd: FormData, name: string) => String(fd.get(name) ?? "").trim();

function validSetupCode(code: string) {
  const expected = Buffer.from(setupSecret());
  const received = Buffer.from(code);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Entrar com e-mail e senha. */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Preencha e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "E-mail ou senha incorretos." };
  redirect("/");
}

/** Primeiro acesso: cria o único usuário da biblioteca. Depois disso, fica fechado. */
export async function createAccess(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (await getOwnerId()) return { error: "O acesso já foi criado. Entre com seu e-mail e senha." };

  const setupCode = field(formData, "setupCode");
  const email = field(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!validSetupCode(setupCode)) return { error: "Código de configuração incorreto." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Digite um e-mail válido." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password !== confirm) return { error: "As senhas não são iguais." };

  const { error } = await createAdminClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return { error: `Não foi possível criar o acesso: ${error.message}` };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: "Acesso criado. Agora entre com seu e-mail e senha." };
  redirect("/");
}

/** Sair. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
