import type { Metadata } from "next";
import { connection } from "next/server";
import { getOwnerId } from "@/lib/supabase/admin";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar · Minha Biblioteca" };

export default async function LoginPage() {
  await connection(); // decide a cada visita, não no build
  // sem nenhum usuário ainda = primeiro acesso: o formulário cria o login do dono
  const mode = (await getOwnerId()) ? "login" : "setup";

  return (
    <main className="relative grid min-h-dvh place-items-center px-6">
      <div className="ambient" />
      <LoginForm mode={mode} />
    </main>
  );
}
