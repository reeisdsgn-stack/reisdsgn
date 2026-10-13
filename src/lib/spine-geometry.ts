import type { Spine } from "./types";

// Código puro (sem Node): usado pelo import do Notion, pela API de cadastro e pela prévia no formulário.

export type SpineColors = { color: string; band: string; ink: string };

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** FNV-1a — "sorteio" estável: cada livro sempre recebe as mesmas variações. */
export const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/** Cor do texto da lombada com contraste suficiente para a cor de fundo. */
export const inkFor = (hex: string) => (luminance(hex) > 0.55 ? "#241f19" : "#f7f2e8");

/** Largura pelas páginas, altura pelo formato, e variações naturais (inclinação, profundidade, tipografia). */
export function spineGeometry(id: string, pages: number, colors: SpineColors): Spine {
  const h = hash(id);
  const rnd = (shift: number, range: number, offset = 0) => (((h >> shift) % 1000) / 1000) * range + offset;
  const binding = pages > 450 ? "capa-dura" : pages < 110 ? "bolso" : "brochura";
  const finish = binding === "capa-dura" ? "tecido" : rnd(3, 1) > 0.5 ? "brilho" : "fosco";
  const height =
    binding === "capa-dura" ? 274 + rnd(5, 16) : binding === "bolso" ? 228 + rnd(7, 14) : 248 + rnd(9, 18);
  const width = Math.round(Math.max(22, Math.min(68, 12 + (pages || 200) * 0.085 + rnd(11, 5))));
  return {
    ...colors,
    width,
    height: Math.round(height),
    binding,
    finish,
    face: (["serif", "regular", "bold"] as const)[h % 3],
    caps: h % 2 === 0,
    lean: Number(rnd(13, 3, -1.5).toFixed(2)),
    depth: Number(rnd(17, 10, -5).toFixed(1)),
  };
}
