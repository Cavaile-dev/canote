import type React from "react";
import { NotebookPen, ClipboardCheck, BookOpen, CalendarCheck, CalendarDays } from "./icons";

export type ControlPanelView =
  | "home"
  | "insights"
  | "chat"
  | "personal-notes"
  | "calendar"
  | "dictionary"
  | "upload"
  | "integrations"
  | "tasks"
  | "quizzes"
  | "exams";

export interface ControlPanelNavItem {
  id: ControlPanelView;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

/**
 * Single source of truth for main-window navigation. The sidebar renders these
 * rows and the top bar shows the active item's label as the page title, so the
 * two can never disagree.
 */
export function useControlPanelNavItems(): ControlPanelNavItem[] {
  return [
    { id: "personal-notes", label: "Smart Note", icon: NotebookPen },
    { id: "calendar", label: "Calender", icon: CalendarDays },
    { id: "tasks", label: "Tugas", icon: ClipboardCheck },
    { id: "quizzes", label: "Quiz", icon: BookOpen },
    { id: "exams", label: "Ulangan", icon: CalendarCheck },
  ];
}
