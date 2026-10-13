import type { NoteSection, Reading, ReadingStatus, Spine } from "../types";
import { hash, inkFor, type SpineColors } from "../spine-geometry";
import { normalizeMarkdown } from "../notes";
import { coverFileFromUrl, deleteCover, moveCover } from "./covers";

/** Dados enviados pelo formulário (cadastro e edição). */
export type BookInput = {
  title: string;
  author: string;
  pages: number;
  status: ReadingStatus;
  pagesRead?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  rating?: number | null;
  genres?: string[];
  themes?: string[];
  /** texto único (livro novo) ou uma seção por leitura (edição) */
  notes?: string | { label: string; year?: number; markdown: string }[];
  cover?: string | null; // URL da capa temporária devolvida por /api/covers (só quando a capa mudou)
  coverAspect?: number;
  colors?: SpineColors | null; // cores extraídas da capa nova
  spineColor?: string | null; // cor escolhida manualmente
  newReading?: boolean; // edição: registrar uma nova leitura (releitura) em vez de alterar a última
};

export class ValidationError extends Error {}
export class NotFoundError extends Error {}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const cleanList = (list?: string[]) => [...new Set((list ?? []).map((s) => s.trim()).filter(Boolean))].slice(0, 12);

// Lombadas sem capa recebem uma cor sóbria, sempre a mesma para o mesmo livro
const FALLBACK = ["#2f4858", "#6b2d2d", "#3d5a40", "#5b4a7a", "#8a5a2b", "#1f3a5f", "#7a3b52", "#44474d"];

export function validateBasics(input: BookInput) {
  const title = input.title?.trim();
  const author = input.author?.trim();
  const pages = Math.round(Number(input.pages));
  if (!title) throw new ValidationError("Informe o título.");
  if (!author) throw new ValidationError("Informe o autor.");
  if (!Number.isFinite(pages) || pages < 1 || pages > 10000) throw new ValidationError("Informe o número de páginas.");
  if (!["quero-ler", "lendo", "lido"].includes(input.status)) throw new ValidationError("Status inválido.");
  return { title, author, pages, genres: cleanList(input.genres), themes: cleanList(input.themes) };
}

/** Leitura a partir do formulário. O ano da estante vem do término, do início ou do ano informado. */
export function readingFrom(input: BookInput, pages: number, fallbackYear: number): Reading {
  const status = input.status;
  const startedAt = status !== "quero-ler" && isDate(input.startedAt) ? input.startedAt : null;
  const finishedAt = status === "lido" && isDate(input.finishedAt) ? input.finishedAt : null;
  const year = Number((finishedAt ?? startedAt)?.slice(0, 4) ?? fallbackYear);
  const pagesRead =
    status === "lido" ? pages : status === "lendo" ? Math.max(0, Math.min(pages, Math.round(Number(input.pagesRead) || 0))) : 0;
  const rating = status === "lido" && input.rating ? Math.max(1, Math.min(5, Math.round(input.rating))) : null;
  return { year, status, startedAt, finishedAt, pagesRead, rating };
}

export function notesFrom(notes: BookInput["notes"], year: number): NoteSection[] {
  const list = typeof notes === "string" ? [{ label: "Anotações", year, markdown: notes }] : (notes ?? []);
  return list
    .map((n) => ({
      label: n.label?.trim() || "Anotações",
      year: Number(n.year) || year,
      markdown: normalizeMarkdown(n.markdown ?? "").trim(),
    }))
    .filter((n) => n.markdown);
}

/** Move a capa temporária para o nome definitivo. Devolve a URL pública ou null. */
export async function adoptTempCover(tmpUrl: string | null | undefined, name: string) {
  const file = coverFileFromUrl(tmpUrl);
  if (!file?.startsWith("tmp-")) return null;
  return moveCover(file, name);
}

export async function removeCover(url: string) {
  await deleteCover(url).catch(() => {});
}

/** Cores da lombada: capa nova > cores atuais > cor padrão; a cor manual sempre vence. */
export function resolveColors(input: BookInput, id: string, current?: Spine): SpineColors {
  let colors: SpineColors =
    input.colors && isHex(input.colors.color)
      ? input.colors
      : current
        ? { color: current.color, band: current.band, ink: current.ink }
        : { color: FALLBACK[hash(id) % FALLBACK.length], band: "#c9a26b", ink: "#f7f2e8" };
  if (isHex(input.spineColor)) colors = { ...colors, color: input.spineColor, ink: inkFor(input.spineColor) };
  return colors;
}

/** Nome de arquivo versionado: capa trocada nunca aparece antiga por causa do cache. */
export const coverName = (id: string) => `${id}-${Date.now().toString(36)}`;
