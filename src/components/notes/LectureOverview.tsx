import { itemCategories, itemCategory, type ItemCategory } from "../../helpers/lectureItemState";
import { useEffect, useMemo, useState } from "react";
import type { NoteItem } from "../../types/electron";
import { collectLectureGroups, type LectureCollection } from "../../helpers/lectureOverview";
import { Button } from "../ui/button";
import LecturePanel from "./LecturePanel";
import { useShareCacheEntry, useSpaces } from "../../stores/noteStore";
import { noteCapabilities, resolveNotePermission } from "../../lib/notePermissions";
import { ownsNote } from "../../lib/spacePermissions";
import { useAllNotes } from "../../hooks/useAllNotes";

export default function LectureOverview({
  collection,
  onOpenNote,
  currentUserId,
}: {
  collection: LectureCollection;
  onOpenNote: (note: NoteItem) => void;
  currentUserId?: string;
}) {
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const categories = itemCategories(collection === "tasks");
  const category =
    selectedCategory && categories.includes(selectedCategory) ? selectedCategory : categories[0];
  const { notes, loading, error } = useAllNotes();
  const allGroups = useMemo(() => collectLectureGroups(notes, collection), [notes, collection]);
  const groups = useMemo(
    () => collectLectureGroups(notes, collection, category, now),
    [notes, collection, category, now]
  );
  const total = groups.reduce((count, group) => count + group.items.length, 0);
  const label = { tasks: "Tugas", quizzes: "Quiz", exams: "Ulangan" }[collection];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 pb-12">
      <header className="rounded-2xl border border-primary/15 bg-primary/5 p-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
          Semua Smart Note
        </p>
        <h1 className="text-2xl font-semibold">
          {label} <span className="text-primary">{total}</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dari {groups.length} note. Periksa kandidat AI dan tandai yang sudah kamu konfirmasi.
        </p>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="Kategori">
        {categories.map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={category === tab ? "default" : "outline"}
            onClick={() => setSelectedCategory(tab)}
          >
            {tab}{" "}
            {allGroups.reduce(
              (count, group) =>
                count +
                group.items.filter(
                  (item) => itemCategory(item, collection === "tasks", now) === tab
                ).length,
              0
            )}
          </Button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Memuat semua note…
        </p>
      ) : !groups.length && !error ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <h2 className="font-semibold">
            Belum ada {label.toLowerCase()} di {category}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {allGroups.length
              ? "Gunakan tombol pada item untuk mengubah statusnya."
              : "Buat atau perbarui ringkasan di Smart Note untuk mengisi daftar ini."}
          </p>
        </div>
      ) : null}
      {groups.map(({ note, items }) => (
        <article
          key={note.id}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/50 px-6 py-4">
            <div>
              <h2 className="font-semibold">{note.title || "Tanpa judul"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{items.length} item</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => onOpenNote(note)}>
              Buka note asal
            </Button>
          </header>
          <OverviewNotePanel
            note={note}
            collection={collection}
            currentUserId={currentUserId}
            category={category}
          />
        </article>
      ))}
    </div>
  );
}

function OverviewNotePanel({
  note,
  collection,
  currentUserId,
  category,
}: {
  note: NoteItem;
  collection: LectureCollection;
  currentUserId?: string;
  category: ItemCategory;
}) {
  const spaces = useSpaces();
  const cache = useShareCacheEntry(note.cloud_id);
  const permission = resolveNotePermission({
    cachedPermission: cache?.access?.my_permission,
    aclState: cache ? "loaded" : note.cloud_id && currentUserId ? "loading" : "unavailable",
    isTeamNote: spaces.some((space) => space.id === note.space_id && space.kind === "team"),
    locallyOwned: ownsNote(note, currentUserId),
  });
  return (
    <LecturePanel
      note={note}
      disabled={!noteCapabilities(permission).canEdit}
      view={collection}
      category={category}
    />
  );
}
