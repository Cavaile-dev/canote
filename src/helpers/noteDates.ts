import type { NoteItem } from "../types/electron";
import { normalizeDbDate } from "../utils/dateFormatting";

type DatedNote = Pick<NoteItem, "created_at">;

export function newestNoteFirst(a: DatedNote, b: DatedNote): number {
  const left = normalizeDbDate(a.created_at).getTime();
  const right = normalizeDbDate(b.created_at).getTime();
  if (Number.isNaN(left)) return Number.isNaN(right) ? 0 : 1;
  if (Number.isNaN(right)) return -1;
  return right - left;
}

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function notesByCreatedDay(notes: NoteItem[]): Map<string, NoteItem[]> {
  const days = new Map<string, NoteItem[]>();
  for (const note of [...notes].sort(newestNoteFirst)) {
    const date = normalizeDbDate(note.created_at);
    if (note.deleted_at || Number.isNaN(date.getTime())) continue;
    const key = localDayKey(date);
    const group = days.get(key) ?? [];
    group.push(note);
    days.set(key, group);
  }
  return days;
}
