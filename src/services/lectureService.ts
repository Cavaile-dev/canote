import { create } from "zustand";
import reasoningService from "./ReasoningService";
import { getSettings, selectResolvedNoteFormatting } from "../stores/settingsStore";
import { buildNoteFormattingOverrides } from "../helpers/noteFormattingOverrides";
import {
  LECTURE_PROMPT,
  lectureSegments,
  lectureChunks,
  parseLectureReply,
  preserveTaskReviews,
  type LectureAnalysis,
} from "../helpers/lectureAnalysis";

export const useLectureJobs = create<{ jobs: Record<number, { busy: boolean; error?: string }> }>(
  () => ({ jobs: {} })
);
const setJob = (id: number, job: { busy: boolean; error?: string }) =>
  useLectureJobs.setState((s) => ({ jobs: { ...s.jobs, [id]: job } }));

export function readLecture(raw?: string | null): LectureAnalysis | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (
      !data ||
      typeof data.notes !== "string" ||
      !Array.isArray(data.tasks) ||
      !Array.isArray(data.highlights)
    )
      return null;
    return {
      ...data,
      quizzes: Array.isArray(data.quizzes) ? data.quizzes : [],
      exams: Array.isArray(data.exams) ? data.exams : [],
    };
  } catch {
    return null;
  }
}

export async function analyzeLecture(noteId: number): Promise<void> {
  if (useLectureJobs.getState().jobs[noteId]?.busy) return;
  setJob(noteId, { busy: true });
  try {
    const note = await window.electronAPI.getNote(noteId);
    if (!note?.transcript?.trim()) throw new Error("Belum ada transkrip untuk dianalisis.");
    const settings = getSettings();
    const config = selectResolvedNoteFormatting(settings);
    if (config.mode !== "providers" && config.mode !== "self-hosted") {
      throw new Error(
        "Pilih Cloud Providers atau Self-Hosted di Settings → Language Models → Note Formatting."
      );
    }
    if (!config.model.trim()) {
      throw new Error("Pilih atau isi model di Settings → Language Models → Note Formatting.");
    }
    if (config.mode === "providers" && !config.provider.trim()) {
      throw new Error("Pilih provider di Settings → Language Models → Note Formatting.");
    }
    const endpoint =
      config.mode === "self-hosted"
        ? config.remoteUrl
        : config.provider === "custom"
          ? config.cloudBaseUrl
          : null;
    if (endpoint !== null && !endpoint?.trim()) {
      throw new Error("Isi URL endpoint custom di Settings → Language Models → Note Formatting.");
    }
    const segments = lectureSegments(note.transcript);
    const parts: LectureAnalysis[] = [];
    for (const chunk of lectureChunks(segments)) {
      const reply = await reasoningService.processText(chunk, config.model, null, {
        ...buildNoteFormattingOverrides(config, false),
        systemPrompt: LECTURE_PROMPT,
        maxTokens: 6000,
        temperature: 0.2,
        requireCompleteOutput: true,
        disableThinking: settings.noteFormattingDisableThinking,
        reasoningEffort: settings.noteFormattingReasoningEffort,
      });
      parts.push(parseLectureReply(reply, segments));
    }
    if (!parts.length) throw new Error("Transkrip kosong.");
    const latest = await window.electronAPI.getNote(noteId);
    if (!latest || latest.transcript !== note.transcript) {
      throw new Error("Transkrip berubah selama analisis. Coba kembali setelah rekaman selesai.");
    }
    const previous = readLecture(latest.lecture_data);
    const generatedAt = new Date().toISOString();
    const result: LectureAnalysis = {
      notes: parts
        .map((part, i) => (parts.length > 1 ? `# Bagian ${i + 1}\n\n${part.notes}` : part.notes))
        .join("\n\n"),
      highlights: parts.flatMap((p) => p.highlights),
      tasks: preserveTaskReviews(
        parts.flatMap((p) => p.tasks).map((item) => ({ ...item, generatedAt })),
        previous?.tasks ?? []
      ),
      quizzes: preserveTaskReviews(
        parts.flatMap((p) => p.quizzes).map((item) => ({ ...item, generatedAt })),
        previous?.quizzes ?? []
      ),
      exams: preserveTaskReviews(
        parts.flatMap((p) => p.exams).map((item) => ({ ...item, generatedAt })),
        previous?.exams ?? []
      ),
    };
    const saved = await window.electronAPI.updateNote(noteId, {
      lecture_data: JSON.stringify(result),
    });
    if (!saved.success) throw new Error("Ringkasan gagal disimpan.");
    setJob(noteId, { busy: false });
  } catch (error) {
    setJob(noteId, { busy: false, error: error instanceof Error ? error.message : String(error) });
  }
}
