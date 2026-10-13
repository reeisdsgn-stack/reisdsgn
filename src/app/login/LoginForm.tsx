"use client";

import { motion } from "motion/react";
import { useActionState } from "react";
import { Logo } from "@/components/Logo";
import { createAccess, signIn, type AuthState } from "./actions";

const field =
  "w-full rounded-md border border-faint bg-transparent px-3.5 py-3 text-[15px] text-ink transition-colors placeholder:text-muted/60 focus:border-accent focus:outline-none";
const label = "text-[10px] font-medium tracking-[0.2em] text-muted uppercase";

export function LoginForm({ mode }: { mode: "login" | "setup" }) {
  const setup = mode === "setup";
  const [state, action, pending] = useActionState<AuthState, FormData>(setup ? createAccess : signIn, undefined);

  return (
    <motion.div
      className="relative z-10 w-full max-w-sm"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <h1 className="flex justify-center text-ink">
        <Logo className="h-auto w-full max-w-[340px]" />
      </h1>
      <p className="mt-4 text-center text-sm text-muted">
        {setup
          ? "Primeira vez por aqui: use seu código de configuração e crie o acesso da sua biblioteca."
          : "Entre para abrir a sua estante."}
      </p>

      <form action={action} className="mt-10 space-y-5 rounded-xl border border-faint bg-panel p-7 backdrop-blur-xl">
        {setup && (
          <label className="block">
            <span className={label}>Código de configuração</span>
            <input
              name="setupCode"
              type="password"
              autoComplete="off"
              required
              minLength={16}
              className={`${field} mt-2`}
            />
          </label>
        )}
        <label className="block">
          <span className={label}>E-mail</span>
          <input name="email" type="email" autoComplete="email" required autoFocus className={`${field} mt-2`} />
        </label>
        <label className="block">
          <span className={label}>Senha</span>
          <input
            name="password"
            type="password"
            autoComplete={setup ? "new-password" : "current-password"}
            required
            minLength={setup ? 8 : undefined}
            className={`${field} mt-2`}
          />
        </label>
        {setup && (
          <label className="block">
            <span className={label}>Confirme a senha</span>
            <input name="confirm" type="password" autoComplete="new-password" required minLength={8} className={`${field} mt-2`} />
          </label>
        )}

        {state?.error && (
          <p role="alert" className="text-sm text-[var(--ribbon)]">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-accent py-3 text-[11px] font-medium tracking-[0.18em] text-accent-ink uppercase transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Um instante…" : setup ? "Criar meu acesso" : "Entrar"}
        </button>
      </form>

      {setup && (
        <p className="mt-5 text-center text-xs text-muted">
          O código é definido por você durante a configuração e não deve ser compartilhado. Depois do primeiro acesso,
          o cadastro fica fechado.
        </p>
      )}
    </motion.div>
  );
}
