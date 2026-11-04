# Canote for Windows

Canote is a fork of OpenWhispr for Indonesian lectures with English terminology.
The original MIT license and attribution remain in LICENSE.

## Development

Use Node.js 24 or newer. Run `npm install`, then `npm run dev`.
The development scripts download native helpers on their first run.
For an unsigned Windows installer, use `npm run build:win -- --config electron-builder.unsigned-win.json`.

On first launch, the Canote setup wizard guides microphone access, multilingual
Whisper download, and the Note Formatting API. Whisper Small is the initial
choice; select another size for your hardware. Recording and
file import default to local Whisper, with Indonesian as the language. Recording
captures the microphone only; local transcript updates use five-second chunks
plus inference time. Allow Windows microphone access when prompted.

In LLMs → Note Formatting select Providers, configure an API key and model.
Custom Provider uses its Base URL and optional API key. Alternatively select
Self-Hosted, then enter the endpoint URL and model; authentication is optional
when the endpoint does not require it.
The selected provider receives transcript text for analysis; its usage fees apply.
No OpenWhispr account is required. Packaged Windows builds check the Canote
GitHub Releases feed at Cavaile-dev/canote; source runs and upstream OpenWhispr
releases are not used for installation. See README.md for the release workflow.

## Navigation and theme

Smart Note opens the notes library. Calender filters notes by their local
creation date and opens their source note. The sidebar's Tugas, Quiz, and Ulangan
pages combine candidates from all notes in the active account, grouped by source.
Use Buka note asal to return to a source note. Lists include older notes beyond
the library's default 100-note window, refresh after note updates, and exclude
deleted notes. Review controls follow the note's permissions.

Canote uses white surfaces, soft pink accents, and rounded cards. The first
launch after this theme update switches to Light; Preferences can change the
light/dark choice afterwards.

## Study workflow

Create a note from a folder, then use its microphone or adjacent upload icon. After recording stops
or import transcription completes, Canote automatically generates study notes.
Open the **Ringkasan** tab for topics, explanations, terms, examples,
conclusions, and highlights. Failed analysis can be retried there.
Open the adjacent **Tugas**, **Quiz**, and **Ulangan** tabs to review candidates.
Each tab shows its total item count, including 0 for empty lists. Quiz and exam
candidates include syllabus guidance only when stated by the lecturer, with
verified source quotes and timestamps. Regenerate older summaries to extract
these new categories. These views scroll
independently of the note header and leave space for the floating chat.
Long transcripts are processed in bounded parts, shown in lecture order.

Highlights and task candidates include exact transcript quotes and timestamps
when the source provides timing. Quotes are checked against the stored transcript.
This checks the source text, not the correctness of AI interpretation.
Every detected task starts as **Perlu review**. Edit and save it, approve it,
cancel it, or return it to review. Regeneration preserves reviewed tasks and edits.

Study notes and task decisions live in the local SQLite `notes.lecture_data`
column and survive restarts. They are not synced through OpenWhispr Cloud.
Older dictation, assistant, team, and cloud code still exists in the fork; primary
navigation exposes Smart Note, Calender, Tugas, Quiz, and Ulangan. Some inherited settings and artwork
still use upstream terminology.

## Validation

`npm run typecheck`, `npm run build:renderer`, and the focused tests:

```powershell
node --import tsx --test test/helpers/lectureAnalysis.test.js test/helpers/lectureDatabase.test.js test/services/lectureService.test.js
```

An end-to-end microphone / API check requires a downloaded Whisper model,
working Windows audio permissions, and the user's API configuration.

## Item workflow

Tugas lists In Progress, Overdue, Done, and Cancelled. Quiz and Ulangan list
Upcoming, Done, and Cancelled. A new AI candidate needs confirmation: check
accepts it, cross cancels it, and pencil opens editing. After acceptance the
buttons become Selesai and Batal; pencil remains available. Finished or cancelled
items can be reactivated. Details stay read-only until pencil is selected.

Dates show the weekday when a complete date is known, the lecturer's literal
schedule when only a relative day is known, or Tidak Diketahui when absent.
Only confirmed tasks with a known deadline become Overdue, after the deadline
date has passed in Asia/Jakarta. An unknown date never becomes overdue and an
exam never completes itself from its date. Quiz and Ulangan show a compact,
editable syllabus summary, or Tidak Diketahui. Older analyses can be regenerated
to extract the new date fields; dates can also be set manually using Edit.

When an exact date is unknown, cards show Tanggal dan hari: Tidak Diketahui
and a separate editable Keterangan waktu for literal instructions such as
"sebelum pertemuan berikutnya" or "Jumat jam 17.00". Dibuat pada shows the
item's first known AI generation date and weekday in Asia/Jakarta, preserved
through edits and regeneration. Legacy items have an unknown generation date
until generated again; the app does not infer it from the note's creation date.
