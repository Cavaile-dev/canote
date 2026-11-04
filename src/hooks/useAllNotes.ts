import { useEffect, useState } from "react";
import type { NoteItem } from "../types/electron";

export function useAllNotes() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      try {
        const allNotes = await window.electronAPI.getNotes(null, -1);
        if (alive && request === generation) {
          setNotes(allNotes);
          setError("");
        }
      } catch {
        if (alive && request === generation) setError("Daftar gagal dimuat. Coba muat ulang.");
      } finally {
        if (alive && request === generation) setLoading(false);
      }
    };
    const refresh = () => {
      void load();
    };
    const stop = [
      window.electronAPI.onNoteAdded?.(refresh),
      window.electronAPI.onNoteUpdated?.(refresh),
      window.electronAPI.onNoteDeleted?.(refresh),
      window.electronAPI.onNoteSynced?.(refresh),
    ];
    refresh();
    return () => {
      alive = false;
      stop.forEach((unsubscribe) => unsubscribe?.());
    };
  }, []);
  return { notes, loading, error };
}
