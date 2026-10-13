"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { signOut } from "@/app/login/actions";
import { Logo } from "@/components/Logo";

export type NavItem = { id: string; label: string };

type Props = {
  items: NavItem[];
  showToday: boolean; // o botão "Li hoje" depende do fuso do navegador
  readToday: boolean;
  onToggleToday: () => void;
  onAdd: () => void;
};

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

/** Barra de navegação fixa no topo: marca, seções e ações. */
export function TopNav({ items, showToday, readToday, onToggleToday, onAdd }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // seção ativa = a última cujo topo já passou de 40% da tela; no topo da página, nenhuma
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
      const line = window.innerHeight * 0.4;
      let current: string | null = null;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= line) current = item.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = items[items.length - 1]?.id ?? null;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    setActive(id);
  };

  const links = (
    <ul className="flex items-center gap-1 sm:gap-2">
      {items.map((item) => {
        const on = active === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => go(item.id)}
              aria-current={on ? "location" : undefined}
              className={`relative px-2.5 py-2 text-[11px] font-medium tracking-[0.14em] whitespace-nowrap uppercase transition-colors ${
                on ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
              {on && (
                <motion.span
                  layoutId="topnav-underline"
                  className="absolute inset-x-2.5 -bottom-px h-px bg-accent"
                  transition={{ type: "spring", stiffness: 420, damping: 38 }}
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled ? "border-b border-faint bg-panel backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
          className="shrink-0 text-ink transition-opacity hover:opacity-80"
          aria-label="Minha Biblioteca — voltar ao início"
        >
          <Logo className="h-5 w-auto sm:h-6" title="" />
        </button>

        <nav aria-label="Seções" className="hidden md:block">
          {links}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {showToday && (
            <button
              onClick={onToggleToday}
              aria-pressed={readToday}
              title={readToday ? "Desmarcar hoje" : "Marcar hoje como dia de leitura"}
              className={`flex h-9 items-center gap-2 rounded-full border px-3.5 text-[11px] font-medium tracking-[0.14em] uppercase transition ${
                readToday
                  ? "border-transparent bg-[var(--st-lido-bg)] text-[var(--st-lido-fg)]"
                  : "border-faint text-ink hover:border-accent"
              }`}
            >
              <span className="text-sm leading-none">{readToday ? "✓" : "○"}</span>
              <span className="hidden lg:inline">{readToday ? "Lido hoje" : "Li hoje"}</span>
            </button>
          )}
          <button
            onClick={onAdd}
            className="flex h-9 items-center gap-2 rounded-full bg-accent px-3.5 text-[11px] font-medium tracking-[0.14em] text-accent-ink uppercase transition hover:brightness-110"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">Adicionar livro</span>
          </button>
          <ThemeToggle />
          <form action={signOut}>
            <button
              type="submit"
              title="Sair"
              aria-label="Sair"
              className="grid size-10 place-items-center rounded-full border border-faint bg-panel text-muted backdrop-blur transition hover:scale-105 hover:text-ink"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* celular: seções numa linha própria, com rolagem */}
      <nav aria-label="Seções" className="no-scrollbar -mt-2 overflow-x-auto px-4 pb-1 md:hidden">
        {links}
      </nav>
    </header>
  );
}
