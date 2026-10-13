import { redirect } from "next/navigation";
import { Library } from "@/components/library/Library";
import { requireOwner, UnauthorizedError } from "@/lib/server/auth";
import { listBooks, listReadingDays } from "@/lib/server/db";

export default async function Home() {
  let session;
  try {
    session = await requireOwner(); // lê cookies: a página é sempre renderizada na hora
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect("/login");
    throw e;
  }

  const [books, readingDays] = await Promise.all([listBooks(session.supabase), listReadingDays(session.supabase)]);

  return (
    <main>
      <Library books={books} readingDays={readingDays} />
    </main>
  );
}
