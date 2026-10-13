import { requireOwner } from "@/lib/server/auth";
import { ValidationError } from "@/lib/server/book-input";
import { cleanupTempCovers, encodeCover, uploadCover } from "@/lib/server/covers";
import { errorResponse } from "@/lib/server/respond";

const MAX_BYTES = 10 * 1024 * 1024;

async function fromUrl(url: string) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new ValidationError("URL inválida.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new ValidationError("URL inválida.");
  const res = await fetch(u, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new ValidationError("Não foi possível baixar a capa.");
  if (!res.headers.get("content-type")?.startsWith("image/")) throw new ValidationError("O link não é uma imagem.");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new ValidationError("Imagem grande demais (máx. 10 MB).");
  return buf;
}

/** Recebe uma capa (arquivo ou URL), comprime, guarda como temporária e devolve cores e proporção. */
export async function POST(request: Request) {
  try {
    await requireOwner();
    let input: Buffer;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const file = (await request.formData()).get("file");
      if (!(file instanceof File)) throw new ValidationError("Envie uma imagem.");
      if (file.size > MAX_BYTES) throw new ValidationError("Imagem grande demais (máx. 10 MB).");
      input = Buffer.from(await file.arrayBuffer());
    } else {
      const { url } = (await request.json()) as { url?: string };
      if (!url) throw new ValidationError("Informe a URL da capa.");
      input = await fromUrl(url);
    }
    const { buffer, coverAspect, colors } = await encodeCover(input).catch(() => {
      throw new ValidationError("Não consegui ler essa imagem.");
    });
    const cover = await uploadCover(buffer, `tmp-${crypto.randomUUID()}`);
    void cleanupTempCovers().catch(() => {});
    return Response.json({ cover, coverAspect, colors });
  } catch (e) {
    return errorResponse(e, "covers", "Falha ao processar a capa.");
  }
}
