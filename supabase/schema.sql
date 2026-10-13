-- ─────────────────────────────────────────────────────────────
-- Minha Biblioteca — estrutura do banco (rodar uma vez no SQL Editor)
-- Pode rodar de novo sem problema: tudo é "se ainda não existir".
-- ─────────────────────────────────────────────────────────────

-- Livros: campos simples em colunas; leituras, anotações e lombada em JSON
create table if not exists public.books (
  id            text primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null,
  author        text not null,
  pages         integer not null check (pages > 0),
  cover         text not null default '',
  cover_aspect  real not null default 1.5,
  genres        text[] not null default '{}',
  themes        text[] not null default '{}',
  readings      jsonb not null default '[]',
  notes         jsonb not null default '[]',
  spine         jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists books_user_id_idx on public.books (user_id);

-- Dias de leitura
create table if not exists public.reading_days (
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date      date not null,
  book_ids  text[] not null default '{}',
  primary key (user_id, date)
);

-- Segurança por linha: cada pessoa logada só enxerga e altera o que é dela
alter table public.books enable row level security;
alter table public.reading_days enable row level security;

drop policy if exists "dono gerencia seus livros" on public.books;
create policy "dono gerencia seus livros" on public.books
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "dono gerencia seus dias" on public.reading_days;
create policy "dono gerencia seus dias" on public.reading_days
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Tabelas não ficam expostas automaticamente: libera só para quem está logado
-- (visitantes anônimos não têm acesso nenhum) e para o servidor
grant select, insert, update, delete on public.books, public.reading_days to authenticated;
grant all on public.books, public.reading_days to service_role;
revoke all on public.books, public.reading_days from anon;

-- Capas: pasta pública só para leitura (a imagem de uma capa não é segredo).
-- Envio, troca e exclusão acontecem apenas pelo servidor do site, com a chave secreta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/webp'])
on conflict (id) do nothing;
