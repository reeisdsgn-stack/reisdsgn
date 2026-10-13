import { requireOwner } from "@/lib/server/auth";
import { setReadingDay, type ReadingDayInput } from "@/lib/server/reading-days";
import { errorResponse } from "@/lib/server/respond";

/** Marca/desmarca um dia de leitura: { date: "AAAA-MM-DD", read: boolean, bookIds?: string[] } */
export async function PUT(request: Request) {
  try {
    const { supabase } = await requireOwner();
    const days = await setReadingDay(supabase, (await request.json()) as ReadingDayInput);
    return Response.json({ days });
  } catch (e) {
    return errorResponse(e, "reading-days", "Não foi possível salvar o dia.");
  }
}
