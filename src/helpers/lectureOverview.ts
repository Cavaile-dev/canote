import { itemCategory, type ItemCategory } from "./lectureItemState";
import type { NoteItem } from "../types/electron";
import type { LectureTask } from "./lectureAnalysis";
import { newestNoteFirst } from "./noteDates";

export type LectureCollection = "tasks" | "quizzes" | "exams";

export function collectLectureGroups(
  notes: NoteItem[],
  collection: LectureCollection,
  category?: ItemCategory,
  now = Date.now()
) {
  return [...notes].sort(newestNoteFirst).flatMap((note) => {
    if (note.deleted_at || !note.lecture_data) return [];
    try {
      const data = JSON.parse(note.lecture_data);
      const items: LectureTask[] = Array.isArray(data?.[collection]) ? data[collection] : [];
      const filtered = category
        ? items.filter((item) => itemCategory(item, collection === "tasks", now) === category)
        : items;
      return filtered.length ? [{ note, items: filtered }] : [];
    } catch {
      return [];
    }
  });
}
