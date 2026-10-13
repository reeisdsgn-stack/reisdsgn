import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { inkFor, type SpineColors } from "../spine-geometry";
import { createAdminClient } from "../supabase/admin";

export const COVERS_DIR = join(process.cwd(), "public", "covers"); // só para o import local do Notion
const BUCKET = "covers";

const toHex = ([r, g, b]: number[]) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const luminance = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * Cor da lombada = média das colunas da borda esquerda da capa (onde fica a lombada real).
 * Se a borda for branca/vazia (capas com margem), usa a média ponderada da capa inteira.
 * Faixa = pixel mais saturado de luminância média.
 */
export async function extractColors(input: Buffer | string): Promise<SpineColors> {
  const W = 80;
  const { data, info } = await sharp(input).resize({ width: W }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const H = info.height;
  const px = (x: number, y: number) => {
    const i = (y * W + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };

  const edge = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < H; y++)
    for (let x = 1; x < 6; x++) {
      const p = px(x, y);
      edge[0] += p[0];
      edge[1] += p[1];
      edge[2] += p[2];
      n++;
    }
  let spine = edge.map((v) => v / n);

  let band = [150, 120, 90];
  let bestSat = -1;
  const all = [0, 0, 0];
  let wsum = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = px(x, y);
      const sat = Math.max(...p) - Math.min(...p);
      const lum = luminance(p);
      if (sat > bestSat && lum > 0.2 && lum < 0.85) {
        bestSat = sat;
        band = p;
      }
      const w = 1 + sat / 40;
      all[0] += p[0] * w;
      all[1] += p[1] * w;
      all[2] += p[2] * w;
      wsum += w;
    }
  if (luminance(spine) > 0.93) spine = all.map((v) => v / wsum);

  const color = toHex(spine);
  return { color, band: toHex(band), ink: inkFor(color) };
}

/** Comprime a capa (WebP 640px) e calcula proporção e cores da lombada. */
export async function encodeCover(input: Buffer | string) {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: 640, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: data,
    coverAspect: Number((info.height / info.width).toFixed(3)),
    colors: await extractColors(input),
  };
}

/** Import do Notion: grava a capa em public/covers/<name>.webp (arquivo local). */
export async function saveCoverToDisk(input: Buffer | string, name: string) {
  const { buffer, coverAspect, colors } = await encodeCover(input);
  await mkdir(COVERS_DIR, { recursive: true });
  await writeFile(join(COVERS_DIR, `${name}.webp`), buffer);
  return { cover: `/covers/${name}.webp`, coverAspect, colors };
}

// ── Storage do Supabase (site) ───────────────────────────────

export function publicCoverUrl(file: string) {
  return createAdminClient().storage.from(BUCKET).getPublicUrl(file).data.publicUrl;
}

/** Nome do arquivo a partir da URL pública da capa (ou null se não for do storage). */
export function coverFileFromUrl(url: string | null | undefined): string | null {
  return url?.match(/\/storage\/v1\/object\/public\/covers\/([\w-]+\.webp)$/)?.[1] ?? null;
}

export async function uploadCover(buffer: Buffer, name: string): Promise<string> {
  const file = `${name}.webp`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(file, buffer, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
  if (error) throw new Error(`Falha ao enviar a capa: ${error.message}`);
  return publicCoverUrl(file);
}

export async function moveCover(fromFile: string, toName: string): Promise<string> {
  const to = `${toName}.webp`;
  const { error } = await createAdminClient().storage.from(BUCKET).move(fromFile, to);
  if (error) throw new Error(`Falha ao salvar a capa: ${error.message}`);
  return publicCoverUrl(to);
}

export async function deleteCover(url: string) {
  const file = coverFileFromUrl(url);
  if (file) await createAdminClient().storage.from(BUCKET).remove([file]);
}

/** Apaga capas temporárias abandonadas (formulário fechado sem salvar) com mais de 1 dia. */
export async function cleanupTempCovers() {
  const storage = createAdminClient().storage.from(BUCKET);
  const { data } = await storage.list("", { search: "tmp-", limit: 100 });
  const old = (data ?? []).filter(
    (f) => f.name.startsWith("tmp-") && f.created_at && Date.now() - Date.parse(f.created_at) > 86_400_000
  );
  if (old.length) await storage.remove(old.map((f) => f.name));
}
