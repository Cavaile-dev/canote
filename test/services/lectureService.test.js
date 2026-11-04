const test = require("node:test");
const assert = require("node:assert/strict");
const { createRendererServer, installBrowserGlobals } = require("../lib/rendererTestHarness");

async function setup(t) {
  const { window } = installBrowserGlobals(t);
  const vite = await createRendererServer(t, {
    mockModules: {
      "../stores/settingsStore": `export const getSettings = () => ({});
        export const selectResolvedNoteFormatting = () => window.lectureConfig ?? ({ mode: 'providers', provider: 'openai', model: 'test-model' });`,
      "./ReasoningService":
        "export default { processText: (...args) => window.lectureLLM(...args) };",
    },
  });
  const service = await vite.ssrLoadModule("/services/lectureService.ts");
  const note = {
    id: 1,
    transcript: JSON.stringify([{ text: "Kerjakan soal 1." }]),
    lecture_data: null,
  };
  const writes = [];
  window.electronAPI.getNote = async () => ({ ...note });
  window.electronAPI.updateNote = async (id, updates) => {
    writes.push([id, updates]);
    Object.assign(note, updates);
    return { success: true };
  };
  window.lectureLLM = async () =>
    JSON.stringify({
      notes: "## Topik\nLatihan",
      highlights: [],
      tasks: [{ text: "Soal 1", quote: "Kerjakan soal 1.", segment: 0 }],
    });
  return { window, service, note, writes };
}

test("lecture analysis persists unapproved tasks through the configured API and preserves review on rerun", async (t) => {
  const { window, service, note, writes } = await setup(t);
  let config;
  const reply = window.lectureLLM;
  window.lectureLLM = async (...args) => {
    config = args[3];
    return reply();
  };
  await service.analyzeLecture(1);
  assert.equal(writes.length, 1);
  assert.equal(config.provider, "openai");
  assert.equal(config.inferenceScope, "noteFormatting");
  const data = JSON.parse(note.lecture_data);
  assert.equal(data.tasks[0].status, "review");
  assert.ok(Number.isFinite(Date.parse(data.tasks[0].generatedAt)));
  const originalGeneratedAt = data.tasks[0].generatedAt;
  data.tasks[0].status = "cancelled";
  data.tasks[0].text = "Tugas yang dibatalkan pengguna";
  note.lecture_data = JSON.stringify(data);
  await service.analyzeLecture(1);
  assert.equal(JSON.parse(note.lecture_data).tasks[0].status, "cancelled");
  assert.equal(JSON.parse(note.lecture_data).tasks[0].generatedAt, originalGeneratedAt);
  assert.equal(JSON.parse(note.lecture_data).tasks[0].text, data.tasks[0].text);
});

test("API failure and concurrent transcript changes leave saved data untouched", async (t) => {
  const { window, service, note, writes } = await setup(t);
  window.lectureLLM = async () => {
    throw new Error("API unavailable");
  };
  await service.analyzeLecture(1);
  assert.equal(writes.length, 0);
  assert.match(service.useLectureJobs.getState().jobs[1].error, /API unavailable/);
  window.lectureLLM = async () => {
    note.transcript = "different";
    return JSON.stringify({ notes: "notes", highlights: [], tasks: [] });
  };
  await service.analyzeLecture(1);
  assert.equal(writes.length, 0);
  assert.match(service.useLectureJobs.getState().jobs[1].error, /Transkrip berubah/);
});

test("a validated self-hosted endpoint reaches lecture analysis without a named provider or API key", async (t) => {
  const { window, service, writes } = await setup(t);
  window.lectureConfig = {
    mode: "self-hosted",
    provider: "",
    model: "custom-model",
    remoteUrl: "http://127.0.0.1:1234/v1",
  };
  const reply = window.lectureLLM;
  let forwarded;
  window.lectureLLM = async (...args) => {
    forwarded = args;
    return reply();
  };
  await service.analyzeLecture(1);
  assert.equal(service.useLectureJobs.getState().jobs[1].error, undefined);
  assert.equal(writes.length, 1);
  assert.equal(forwarded[1], "custom-model");
  assert.equal(forwarded[3].lanUrl, window.lectureConfig.remoteUrl);
  assert.equal(forwarded[3].inferenceScope, "noteFormatting");
});

test("a custom provider forwards its scope endpoint, model and key", async (t) => {
  const { window, service, writes } = await setup(t);
  window.lectureConfig = {
    mode: "providers",
    provider: "custom",
    model: "my-model",
    cloudBaseUrl: "https://example.test/v1",
    customApiKey: "test-scope-key",
  };
  const reply = window.lectureLLM;
  let forwarded;
  window.lectureLLM = async (...args) => {
    forwarded = args;
    return reply();
  };
  await service.analyzeLecture(1);
  assert.equal(service.useLectureJobs.getState().jobs[1].error, undefined);
  assert.equal(writes.length, 1);
  assert.equal(forwarded[1], "my-model");
  assert.equal(forwarded[3].provider, "custom");
  assert.equal(forwarded[3].baseUrl, "https://example.test/v1");
  assert.equal(forwarded[3].customApiKey, "test-scope-key");
  assert.equal(forwarded[3].lanUrl, undefined);
});

test("missing custom endpoints fail before dispatch instead of falling back to another service", async (t) => {
  const { window, service, writes } = await setup(t);
  let requests = 0;
  window.lectureLLM = async () => {
    requests++;
    throw new Error("must not call");
  };
  for (const config of [
    { mode: "self-hosted", model: "test", remoteUrl: " " },
    { mode: "providers", provider: "custom", model: "test", cloudBaseUrl: "" },
  ]) {
    window.lectureConfig = config;
    await service.analyzeLecture(1);
    assert.match(service.useLectureJobs.getState().jobs[1].error, /URL endpoint custom/);
  }
  assert.equal(requests, 0);
  assert.equal(writes.length, 0);
});

test("quiz and exam lists persist separately and keep review decisions on regeneration", async (t) => {
  const { window, service, note } = await setup(t);
  note.transcript = JSON.stringify([{ text: "Besok quiz aljabar. UTS Jumat mencakup matriks." }]);
  window.lectureLLM = async () =>
    JSON.stringify({
      notes: "## Topik\nAljabar",
      highlights: [],
      tasks: [],
      quizzes: [
        {
          text: "Quiz besok",
          quote: "Besok quiz aljabar.",
          segment: 0,
          syllabus: [{ text: "Aljabar", quote: "quiz aljabar", segment: 0 }],
        },
      ],
      exams: [
        {
          text: "UTS Jumat",
          quote: "UTS Jumat mencakup matriks.",
          segment: 0,
          syllabus: [{ text: "Matriks", quote: "mencakup matriks", segment: 0 }],
        },
      ],
    });
  await service.analyzeLecture(1);
  const first = service.readLecture(note.lecture_data);
  assert.equal(first.tasks.length, 0);
  assert.equal(first.quizzes.length, 1);
  assert.equal(first.exams.length, 1);
  assert.equal(first.exams[0].syllabus[0].text, "Matriks");
  first.quizzes[0].status = "approved";
  first.quizzes[0].text = "Quiz yang telah diperiksa";
  first.exams[0].status = "cancelled";
  note.lecture_data = JSON.stringify(first);
  await service.analyzeLecture(1);
  const next = service.readLecture(note.lecture_data);
  assert.equal(next.quizzes[0].status, "approved");
  assert.equal(next.quizzes[0].text, "Quiz yang telah diperiksa");
  assert.equal(next.exams[0].status, "cancelled");
  const legacy = service.readLecture(JSON.stringify({ notes: "old", tasks: [], highlights: [] }));
  assert.deepEqual(legacy.quizzes, []);
  assert.deepEqual(legacy.exams, []);
});
