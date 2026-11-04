import { useMemo, useState } from "react";
import type { NoteItem } from "../../types/electron";
import { useAllNotes } from "../../hooks/useAllNotes";
import { useUiLocale } from "../../hooks/useUiLocale";
import { localDayKey, notesByCreatedDay } from "../../helpers/noteDates";
import { normalizeDbDate } from "../../utils/dateFormatting";
import { Button } from "../ui/button";
import { CalendarDays, ChevronLeft, ChevronRight, FileText } from "../icons";
import { cn } from "../lib/utils";

export default function NoteCalendar({ onOpenNote }: { onOpenNote: (note: NoteItem) => void }) {
  const locale = useUiLocale();
  const { notes, loading, error } = useAllNotes();
  const [selected, setSelected] = useState(() => new Date());
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const groups = useMemo(() => notesByCreatedDay(notes), [notes]);
  const selectedKey = localDayKey(selected);
  const selectedNotes = groups.get(selectedKey) ?? [];
  const today = localDayKey(new Date());
  const startOffset = (month.getDay() + 6) % 7;
  const days = Array.from(
    { length: 42 },
    (_, index) => new Date(month.getFullYear(), month.getMonth(), index - startOffset + 1)
  );
  const dateLabel = (date: Date) =>
    date.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const selectDay = (day: Date) => {
    setSelected(day);
    setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 pb-12">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <CalendarDays className="text-primary" size={25} /> Calender
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pilih tanggal untuk melihat note yang dibuat pada hari itu.
        </p>
      </header>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section
          className="rounded-2xl border border-primary/15 bg-card p-4"
          aria-label="Kalender tanggal pembuatan note"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold" aria-live="polite">
              {month.toLocaleDateString(locale, { month: "long", year: "numeric" })}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label="Bulan sebelumnya"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button size="sm" variant="outline" onClick={() => selectDay(new Date())}>
                Hari ini
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Bulan berikutnya"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
          <div
            className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground"
            aria-hidden="true"
          >
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = localDayKey(day);
              const count = groups.get(key)?.length ?? 0;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectDay(day)}
                  aria-label={`${dateLabel(day)}, ${count} note`}
                  aria-pressed={key === selectedKey}
                  aria-current={key === today ? "date" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-transparent text-sm transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    day.getMonth() !== month.getMonth() && "text-muted-foreground/50",
                    key === today && "border-primary/40",
                    key === selectedKey && "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  <span>{day.getDate()}</span>
                  <span className="h-3 text-[10px] leading-3">{count ? `${count} note` : ""}</span>
                </button>
              );
            })}
          </div>
        </section>
        <section className="space-y-3" aria-label="Note pada tanggal terpilih" aria-live="polite">
          <h2 className="font-semibold">{dateLabel(selected)}</h2>
          <p className="text-sm text-muted-foreground">{selectedNotes.length} note</p>
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Memuat note…
            </p>
          ) : !selectedNotes.length && !error ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Belum ada note yang dibuat pada tanggal ini.
            </p>
          ) : null}
          {selectedNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onOpenNote(note)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-start transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <FileText size={19} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate font-medium">{note.title || "Tanpa judul"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {normalizeDbDate(note.created_at).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                  })}
                </p>
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
