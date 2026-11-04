import type { LectureTask } from "./lectureAnalysis";

export type ItemCategory = "In Progress" | "Upcoming" | "Overdue" | "Done" | "Cancelled";
export function itemCategories(tasks: boolean): ItemCategory[] {
  return tasks
    ? ["In Progress", "Overdue", "Done", "Cancelled"]
    : ["Upcoming", "Done", "Cancelled"];
}
export function validDueDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function itemCategory(item: LectureTask, tasks: boolean, now = Date.now()): ItemCategory {
  if (item.status === "done") return "Done";
  if (item.status === "cancelled") return "Cancelled";
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  const today = `${value("year")}-${value("month")}-${value("day")}`;
  if (tasks && item.status === "approved" && validDueDate(item.dueDate) && item.dueDate < today)
    return "Overdue";
  return tasks ? "In Progress" : "Upcoming";
}
export function itemDate(item: LectureTask): string {
  if (validDueDate(item.dueDate))
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${item.dueDate}T12:00:00+07:00`));
  return "Tidak Diketahui";
}
export function itemSyllabus(item: LectureTask): string {
  return item.syllabusSummary ?? item.syllabus?.map((topic) => topic.text).join("\n") ?? "";
}

export function itemGeneratedDate(item: LectureTask): string {
  if (!item.generatedAt || !Number.isFinite(Date.parse(item.generatedAt))) return "Tidak Diketahui";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(item.generatedAt));
}
