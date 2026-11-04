const test = require("node:test");
const assert = require("node:assert/strict");
const load = () => import("../../src/helpers/lectureItemState.ts");
const now = Date.parse("2026-11-02T00:30:00+07:00");

test("task categories preserve explicit decisions and derive overdue in Jakarta", async () => {
  const { itemCategory } = await load();
  assert.equal(itemCategory({ status: "review", dueDate: "2026-11-01" }, true, now), "In Progress");
  assert.equal(itemCategory({ status: "approved", dueDate: "2026-11-01" }, true, now), "Overdue");
  assert.equal(
    itemCategory({ status: "approved", dueDate: "2026-11-02" }, true, now),
    "In Progress"
  );
  assert.equal(itemCategory({ status: "done", dueDate: "2026-11-01" }, true, now), "Done");
  assert.equal(
    itemCategory({ status: "cancelled", dueDate: "2026-11-01" }, true, now),
    "Cancelled"
  );
  assert.equal(itemCategory({ status: "approved" }, true, now), "In Progress");
  assert.equal(
    itemCategory({ status: "approved", dueDate: "2026-11-01" }, false, now),
    "Upcoming",
    "a past date must not mark an exam completed automatically"
  );
});

test("unknown and relative schedules are shown without invented dates", async () => {
  const { itemDate, validDueDate, itemSyllabus } = await load();
  assert.equal(itemDate({}), "Tidak Diketahui");
  assert.equal(itemDate({ dateText: "Jumat depan" }), "Tidak Diketahui");
  assert.match(itemDate({ dueDate: "2026-11-02" }), /Senin.*2.*November.*2026/);
  assert.equal(validDueDate("2026-02-30"), false);
  assert.equal(validDueDate("2028-02-29"), true);
  assert.equal(itemSyllabus({ syllabus: [{ text: "Aljabar" }] }), "Aljabar");
  assert.equal(
    itemSyllabus({ syllabusSummary: "", syllabus: [{ text: "Aljabar" }] }),
    "",
    "an intentional clear stays cleared"
  );
});

test("global lists filter across all notes without losing source identities", async () => {
  const { collectLectureGroups } = await import("../../src/helpers/lectureOverview.ts");
  const notes = [1, 2].map((id) => ({
    id,
    title: `Note ${id}`,
    lecture_data: JSON.stringify({
      tasks: [{ status: "done" }, { status: "approved", dueDate: "2026-11-01" }],
    }),
  }));
  assert.equal(collectLectureGroups(notes, "tasks", "Done", now).length, 2);
  assert.equal(collectLectureGroups(notes, "tasks", "Overdue", now)[1].note.id, 2);
  assert.equal(collectLectureGroups(notes, "tasks", "In Progress", now).length, 0);
});

test("edited dates, syllabus and completed states survive AI regeneration", async () => {
  const { preserveTaskReviews, parseLectureReply } =
    await import("../../src/helpers/lectureAnalysis.ts");
  const item = { text: "Tugas", quote: "Kerjakan", segment: 0, status: "review" };
  const edited = {
    ...item,
    status: "done",
    dueDate: "2026-11-02",
    dateText: null,
    syllabusSummary: "Materi revisi",
    edited: true,
  };
  assert.deepEqual(preserveTaskReviews([item], [edited]), [edited]);
  assert.deepEqual(preserveTaskReviews([], [edited]), [edited]);
  const reply = { notes: "Materi", highlights: [], tasks: [{ ...item, dueDate: "2026-02-30" }] };
  assert.throws(
    () => parseLectureReply(JSON.stringify(reply), [{ text: "Kerjakan" }]),
    /Tanggal AI/
  );
  reply.tasks[0].dueDate = "2026-11-02";
  reply.tasks[0].dateText = "Senin";
  assert.throws(
    () => parseLectureReply(JSON.stringify(reply), [{ text: "Kerjakan" }]),
    /Jadwal AI/
  );
});

test("generation dates use Jakarta day and are never fabricated for legacy items", async () => {
  const { itemGeneratedDate } = await load();
  assert.equal(itemGeneratedDate({}), "Tidak Diketahui");
  assert.equal(itemGeneratedDate({ generatedAt: "broken" }), "Tidak Diketahui");
  assert.match(
    itemGeneratedDate({ generatedAt: "2026-11-01T18:00:00Z" }),
    /Senin.*2.*November.*2026/
  );
});
