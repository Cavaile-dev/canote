import LectureItemCard from "./LectureItemCard";
import {
  itemCategories,
  itemCategory,
  validDueDate,
  type ItemCategory,
} from "../../helpers/lectureItemState";
import { useEffect, useState } from "react";
import MarkdownRenderer from "../ui/MarkdownRenderer";
import { Button } from "../ui/button";
import type { NoteItem } from "../../types/electron";
import type { LectureAnalysis, LectureTask } from "../../helpers/lectureAnalysis";
import { analyzeLecture, readLecture, useLectureJobs } from "../../services/lectureService";

export default function LecturePanel({
  note,
  disabled,
  view,
  category,
}: {
  note: NoteItem;
  disabled: boolean;
  view: "summary" | "tasks" | "quizzes" | "exams";
  category?: ItemCategory;
}) {
  const job = useLectureJobs((s) => s.jobs[note.id]);
  const [data, setData] = useState(() => readLecture(note.lecture_data));
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [error, setError] = useState("");
  useEffect(() => {
    setData(readLecture(note.lecture_data));
    setError("");
  }, [note.id, note.lecture_data]);

  const labels = { summary: "Ringkasan", tasks: "Tugas", quizzes: "Quiz", exams: "Ulangan" };
  const collection = view === "summary" ? "tasks" : view;
  const items = data?.[collection] ?? [];
  const categories = itemCategories(collection === "tasks");
  const activeCategory =
    category ??
    (selectedCategory && categories.includes(selectedCategory) ? selectedCategory : categories[0]);

  const saveTask = async (index: number, updates: Partial<LectureTask>) => {
    if (!data || saving) return false;
    const text = (updates.text ?? items[index].text).trim();
    if (!text) {
      setError("Isi item tidak boleh kosong.");
      return false;
    }
    if (updates.dueDate && !validDueDate(updates.dueDate)) {
      setError("Tanggal tidak valid.");
      return false;
    }
    setSaving(true);
    setError("");
    const next: LectureAnalysis = {
      ...data,
      [collection]: items.map((task, i) => (i === index ? { ...task, text, ...updates } : task)),
    };
    try {
      const result = await window.electronAPI.updateNote(note.id, {
        lecture_data: JSON.stringify(next),
      });
      if (!result.success) throw new Error("Perubahan item gagal disimpan.");
      setData(next);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6 break-words"
      aria-label={labels[view]}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{labels[view]}</h2>
          <p className="text-sm text-muted-foreground">
            {view === "summary"
              ? "Materi kuliah dan highlight penting."
              : "Review kandidat penilaian atau tugas sebelum menyetujuinya."}
          </p>
        </div>
        {view === "summary" && (
          <Button
            variant="outline"
            disabled={disabled || job?.busy || saving || !note.transcript}
            onClick={() => void analyzeLecture(note.id)}
          >
            {job?.busy ? "Menyusun ringkasan…" : data ? "Buat ulang" : "Buat ringkasan"}
          </Button>
        )}
      </div>
      {(job?.error || error) && (
        <p role="alert" className="text-sm text-destructive">
          {job?.error || error}
        </p>
      )}
      {!data && (
        <p className="text-sm text-muted-foreground">
          {view === "summary"
            ? "Ringkasan dibuat otomatis setelah rekaman atau impor selesai. Analisis mengirim teks transkrip ke provider API pilihanmu."
            : "Daftar muncul setelah ringkasan selesai dibuat. Untuk catatan lama, klik Buat ulang di tab Ringkasan."}
        </p>
      )}
      {data && view === "summary" && (
        <>
          <MarkdownRenderer
            content={data.notes}
            className="rounded-xl border border-border bg-surface-2/30 p-6 text-sm leading-7 [overflow-wrap:anywhere] [&_h1]:mt-8 [&_h1]:mb-3 [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:mb-4 [&_ol]:mb-4 [&>:first-child]:mt-0"
          />
          <h3 className="font-semibold">Highlight penting · {data.highlights.length}</h3>
          {!data.highlights.length && (
            <p className="text-sm text-muted-foreground">Tidak ada highlight yang terdeteksi.</p>
          )}
          {data.highlights.map((item, i) => (
            <article key={i} className="rounded-lg border border-border p-3 text-sm">
              <p>{item.text}</p>
              <blockquote className="mt-2 border-l-2 border-primary pl-3 text-muted-foreground">
                “{item.quote}”
              </blockquote>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.time ?? "Waktu tidak tersedia"} · Segmen {item.segment + 1}
              </p>
            </article>
          ))}
        </>
      )}
      {data && view !== "summary" && (
        <>
          {!category && (
            <nav className="flex flex-wrap gap-2" aria-label="Kategori">
              {categories.map((tab) => (
                <Button
                  key={tab}
                  size="sm"
                  variant={tab === activeCategory ? "default" : "outline"}
                  onClick={() => setSelectedCategory(tab)}
                >
                  {tab}{" "}
                  {
                    items.filter((item) => itemCategory(item, collection === "tasks", now) === tab)
                      .length
                  }
                </Button>
              ))}
            </nav>
          )}
          {!items.some(
            (item) => itemCategory(item, collection === "tasks", now) === activeCategory
          ) && <p className="text-sm text-muted-foreground">Belum ada item di {activeCategory}.</p>}
          {items.map((item, index) =>
            itemCategory(item, collection === "tasks", now) === activeCategory ? (
              <LectureItemCard
                key={`${note.id}:${collection}:${index}`}
                item={item}
                label={labels[view]}
                assessment={view !== "tasks"}
                disabled={disabled || saving || !!job?.busy}
                onSave={(updates) => saveTask(index, updates)}
              />
            ) : null
          )}
        </>
      )}
    </section>
  );
}
