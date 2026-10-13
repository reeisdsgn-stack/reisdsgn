import type { NextRequest } from "next/server";
import { requireOwner } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/respond";

export type SearchResult = {
  key: string;
  title: string;
  author: string;
  pages: number | null;
  year: number | null;
  cover: string | null;
  isbn: string | null;
  source: "Open Library" | "BrasilAPI" | "Google Books";
};

// sinal novo por requisição (um sinal criado no carregamento do módulo expiraria para sempre)
const timeout = (ms = 8_000) => ({ signal: AbortSignal.timeout(ms) });

/** fetch com uma nova tentativa quando a conexão cai (a Open Library às vezes derruba a primeira). */
async function get(url: string, ms?: number) {
  try {
    return await fetch(url, timeout(ms));
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") throw e;
    return fetch(url, timeout(ms));
  }
}

const describe = (e: unknown) =>
  e instanceof Error ? `${e.name}: ${e.message}${e.cause ? ` (${(e.cause as { code?: string }).code ?? e.cause})` : ""}` : String(e);

// A Open Library demora vários segundos na primeira consulta de um termo; guardamos por 30 min
const CACHE_TTL = 30 * 60_000;
const cache = new Map<string, { at: number; results: SearchResult[] }>();

type OLDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  number_of_pages_median?: number;
  isbn?: string[];
};

async function openLibrary(q: string, isbn: string | null): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    limit: "10",
    lang: "pt",
    fields: "key,title,author_name,first_publish_year,cover_i,number_of_pages_median,isbn",
  });
  params.set(isbn ? "isbn" : "q", isbn ?? q);
  const res = await get(`https://openlibrary.org/search.json?${params}`, 15_000);
  if (!res.ok) throw new Error(`Open Library ${res.status}`);
  const { docs = [] } = (await res.json()) as { docs?: OLDoc[] };
  return docs.map((d) => ({
    key: `ol:${d.key}`,
    title: d.title,
    author: d.author_name?.[0] ?? "",
    pages: d.number_of_pages_median ?? null,
    year: d.first_publish_year ?? null,
    cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    isbn: isbn ?? d.isbn?.find((i) => i.length === 13) ?? null,
    source: "Open Library" as const,
  }));
}

// Boa para edições brasileiras (CBL, Mercado Editorial…)
async function brasilApi(isbn: string): Promise<SearchResult[]> {
  const res = await get(`https://brasilapi.com.br/api/isbn/v1/${isbn}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`BrasilAPI ${res.status}`);
  const d = (await res.json()) as {
    title?: string;
    authors?: string[];
    page_count?: number;
    year?: number;
    cover_url?: string | null;
  };
  if (!d.title) return [];
  return [
    {
      key: `br:${isbn}`,
      title: d.title,
      author: d.authors?.[0] ?? "",
      pages: d.page_count || null,
      year: d.year || null,
      cover: d.cover_url ?? null,
      isbn,
      source: "BrasilAPI",
    },
  ];
}

// Opcional: exige uma chave gratuita em GOOGLE_BOOKS_API_KEY
async function googleBooks(q: string, isbn: string | null): Promise<SearchResult[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({ q: isbn ? `isbn:${isbn}` : q, maxResults: "8", printType: "books", key });
  const res = await get(`https://www.googleapis.com/books/v1/volumes?${params}`);
  if (!res.ok) throw new Error(`Google Books ${res.status}`);
  const { items = [] } = (await res.json()) as {
    items?: {
      id: string;
      volumeInfo: {
        title: string;
        authors?: string[];
        pageCount?: number;
        publishedDate?: string;
        imageLinks?: { thumbnail?: string };
        industryIdentifiers?: { type: string; identifier: string }[];
      };
    }[];
  };
  return items.map(({ id, volumeInfo: v }) => ({
    key: `gb:${id}`,
    title: v.title,
    author: v.authors?.[0] ?? "",
    pages: v.pageCount ?? null,
    year: v.publishedDate ? Number(v.publishedDate.slice(0, 4)) : null,
    cover: v.imageLinks?.thumbnail?.replace("http://", "https://").replace("&edge=curl", "") ?? null,
    isbn: v.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ?? null,
    source: "Google Books" as const,
  }));
}

/** Busca por título, autor ou ISBN em fontes gratuitas. */
export async function GET(request: NextRequest) {
  try {
    await requireOwner();
  } catch (e) {
    return errorResponse(e, "search", "Faça login para continuar.");
  }
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ results: [] });
  // ISBN só quando a busca é feita apenas de dígitos (com hífens/espaços opcionais)
  const digits = /^[\d\-\sXx]+$/.test(q) ? q.replace(/[^0-9Xx]/g, "") : "";
  const isbn = digits.length === 10 || digits.length === 13 ? digits.toUpperCase() : null;

  const cacheKey = q.toLowerCase();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL) return Response.json({ results: hit.results });

  const settled = await Promise.allSettled([
    isbn ? brasilApi(isbn) : Promise.resolve([]),
    googleBooks(q, isbn),
    openLibrary(q, isbn),
  ]);
  for (const s of settled) if (s.status === "rejected") console.warn("[search]", q, describe(s.reason));
  const all = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));

  // remove repetidos (mesmo título + autor), priorizando quem tem capa
  const seen = new Map<string, SearchResult>();
  for (const r of all) {
    const k = `${r.title}|${r.author}`.toLowerCase();
    const prev = seen.get(k);
    if (!prev || (!prev.cover && r.cover)) seen.set(k, { ...prev, ...r, pages: r.pages ?? prev?.pages ?? null });
  }
  const results = [...seen.values()].slice(0, 12);
  if (results.length) {
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { at: Date.now(), results });
  }
  return Response.json({ results });
}
