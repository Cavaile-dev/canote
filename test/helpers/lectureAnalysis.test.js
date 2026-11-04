const { test } = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../src/helpers/lectureAnalysis.ts");
const segments = [
  { text: "Hari ini kita belajar gradient descent.", timestamp: 100000 },
  {
    text: "Bab ini kemungkinan masuk ujian. Kerjakan soal 1 sampai 5 untuk Jumat.",
    timestamp: 165000,
  },
];
const reply = () => ({
  notes: "## Topik\nGradient descent",
  highlights: [{ text: "Petunjuk ujian", quote: "kemungkinan masuk ujian", segment: 1 }],
  tasks: [{ text: "Soal 1–5, Jumat", quote: "Kerjakan soal 1 sampai 5 untuk Jumat.", segment: 1 }],
});

test("lecture evidence uses actual transcript timing and tasks always start in review", async () => {
  const { parseLectureReply } = await load();
  const result = parseLectureReply(JSON.stringify(reply()), segments);
  assert.equal(result.highlights[0].time, "1:05");
  assert.equal(result.tasks[0].status, "review");
  assert.equal(
    parseLectureReply(
      JSON.stringify(reply()),
      segments.map((s) => ({ text: s.text }))
    ).tasks[0].time,
    null
  );
});
test("invented evidence, malformed JSON and wrong response shapes are rejected", async () => {
  const { parseLectureReply } = await load();
  const invalid = reply();
  invalid.tasks[0].quote = "Kumpulkan Senin";
  assert.throws(() => parseLectureReply(JSON.stringify(invalid), segments));
  assert.throws(() => parseLectureReply("{", segments));
  assert.throws(() => parseLectureReply('{"notes":"hello"}', segments));
});
test("regeneration keeps user edits and decisions, even when AI misses a reviewed task", async () => {
  const { parseLectureReply, preserveTaskReviews } = await load();
  const tasks = parseLectureReply(JSON.stringify(reply()), segments).tasks;
  const previous = [{ ...tasks[0], text: "Soal revisi", status: "approved" }];
  assert.deepEqual(preserveTaskReviews([...tasks, ...tasks], previous), previous);
  assert.deepEqual(preserveTaskReviews([], previous), previous);
});
test("long transcripts split into bounded requests with stable source ids", async () => {
  const { lectureChunks, lectureSegments } = await load();
  const source = [{ text: "a".repeat(40000) }, { text: "Tugas terakhir" }];
  const chunks = lectureChunks(source);
  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every((c) => c.length <= 16000));
  const rows = chunks.flatMap((c) => c.trim().split("\n").map(JSON.parse));
  assert.equal(
    rows
      .filter((r) => r.segment === 0)
      .map((r) => r.text)
      .join(""),
    source[0].text
  );
  assert.equal(rows.at(-1).segment, 1);
  assert.deepEqual(lectureSegments("plain transcript"), [{ text: "plain transcript" }]);
});

test("quiz and exam candidates include independently verified syllabus evidence", async () => {
  const { parseLectureReply, preserveTaskReviews } = await load();
  const source = [
    { text: "Besok ada quiz.", timestamp: 100000 },
    { text: "Quiz membahas mean dan median.", timestamp: 160000 },
    { text: "UTS minggu depan mencakup regresi.", timestamp: 220000 },
  ];
  const data = {
    notes: "## Topik\nStatistika",
    highlights: [],
    tasks: [],
    quizzes: [
      {
        text: "Quiz besok",
        quote: "Besok ada quiz.",
        segment: 0,
        status: "approved",
        syllabus: [
          { text: "Mean dan median", quote: "Quiz membahas mean dan median.", segment: 1 },
        ],
      },
    ],
    exams: [
      {
        text: "UTS minggu depan",
        quote: "UTS minggu depan mencakup regresi.",
        segment: 2,
        syllabus: [{ text: "Regresi", quote: "mencakup regresi", segment: 2 }],
      },
    ],
  };
  const result = parseLectureReply(JSON.stringify(data), source);
  assert.equal(result.quizzes[0].status, "review", "AI cannot approve its own candidates");
  assert.equal(result.exams[0].status, "review");
  assert.equal(result.quizzes[0].syllabus[0].time, "1:00");
  assert.equal(result.exams[0].syllabus[0].time, "2:00");
  assert.equal(result.tasks.length, 0);
  const approved = [{ ...result.quizzes[0], status: "approved", text: "Quiz dikonfirmasi" }];
  assert.deepEqual(preserveTaskReviews(result.quizzes, approved), approved);
  data.quizzes[0].syllabus[0].quote = "Integral pasti keluar";
  assert.throws(() => parseLectureReply(JSON.stringify(data), source), /Kutipan AI/);
});

test("legacy replies default to zero quiz/exam candidates and absent syllabus stays empty", async () => {
  const { parseLectureReply } = await load();
  const legacy = parseLectureReply(JSON.stringify(reply()), segments);
  assert.deepEqual(legacy.quizzes, []);
  assert.deepEqual(legacy.exams, []);
  const data = {
    ...reply(),
    quizzes: [{ text: "Petunjuk ujian", quote: "kemungkinan masuk ujian", segment: 1 }],
  };
  assert.deepEqual(parseLectureReply(JSON.stringify(data), segments).quizzes[0].syllabus, []);
  data.quizzes[0].syllabus = "kisi-kisi palsu";
  assert.throws(() => parseLectureReply(JSON.stringify(data), segments), /Format kisi-kisi/);
  assert.throws(() => parseLectureReply(JSON.stringify({ ...reply(), exams: {} }), segments));
});
