import { cleanupTempCovers } from "@/lib/server/covers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Chamada 1x por dia pelo Cron da Vercel (vercel.json). Uma consulta simples mantém o
 * projeto gratuito do Supabase ativo (ele pausa após 7 dias sem uso) e aproveita para
 * limpar capas temporárias abandonadas. Só responde a quem manda o CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { error } = await createAdminClient().from("books").select("id", { count: "exact", head: true });
  if (error) {
    console.error("[keep-alive]", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
  await cleanupTempCovers().catch((e) => console.error("[keep-alive] limpeza de capas:", e));
  return Response.json({ ok: true });
}
