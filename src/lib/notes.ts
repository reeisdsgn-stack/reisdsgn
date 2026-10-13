// Anotações são guardadas em Markdown simples:
//   ### Capítulo
//   - anotação
// O editor visual trabalha com capítulos e itens e converte de/para esse formato.

export type NoteItem = { id: string; text: string };
export type NoteChapter = { id: string; title: string; items: NoteItem[] };

let seq = 0;
export const newId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Corrige Markdown digitado à mão: "###Título" → "### Título", "-item" → "- item". */
export function normalizeMarkdown(md: string) {
  return md
    .replace(/\r/g, "")
    .replace(/^(\s*)(#{1,6})(?=[^\s#])/gm, "$1$2 ")
    .replace(/^(\s*)[-*•](?=[^\s\-*])/gm, "$1- ");
}

export function parseNotes(md: string): NoteChapter[] {
  const chapters: NoteChapter[] = [];
  let current: NoteChapter | null = null;
  const ensure = () => {
    if (!current) {
      current = { id: newId(), title: "", items: [] };
      chapters.push(current);
    }
    return current;
  };
  for (const raw of normalizeMarkdown(md).split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      current = { id: newId(), title: heading[1].trim(), items: [] };
      chapters.push(current);
      continue;
    }
    ensure().items.push({ id: newId(), text: line.replace(/^[-*•]\s+/, "") });
  }
  return chapters;
}

export function serializeNotes(chapters: NoteChapter[]): string {
  return chapters
    .map((c) => {
      const items = c.items.map((i) => i.text.trim().replace(/\s*\n\s*/g, " ")).filter(Boolean);
      if (!c.title.trim() && !items.length) return "";
      return [c.title.trim() && `### ${c.title.trim()}`, ...items.map((t) => `- ${t}`)].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}
