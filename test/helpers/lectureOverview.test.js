const test = require("node:test");
const assert = require("node:assert/strict");

test("all assessment lists sort by source note creation, regardless of update or due dates", async () => {
  const { collectLectureGroups } = await import("../../src/helpers/lectureOverview.ts");
  const item = { text: "Assessment", status: "review", dueDate: "2026-12-01" };
  const lecture_data = JSON.stringify({ tasks: [item], quizzes: [item], exams: [item] });
  const notes = [
    { id: 1, created_at: "2026-11-01 10:00:00", updated_at: "2026-12-01", lecture_data },
    { id: 2, created_at: "2026-11-04T10:00:00Z", updated_at: "2026-11-04", lecture_data },
    { id: 3, created_at: "2026-11-04T09:00:00Z", updated_at: "2026-11-05", lecture_data },
    { id: 4, created_at: "invalid", lecture_data },
  ];
  for (const collection of ["tasks", "quizzes", "exams"]) {
    assert.deepEqual(
      collectLectureGroups(notes, collection).map((group) => group.note.id),
      [2, 3, 1, 4]
    );
  }
  assert.deepEqual(
    notes.map((note) => note.id),
    [1, 2, 3, 4]
  );
});

test("overview collects older notes across folders and keeps each source identity", async () => {
  const { collectLectureGroups } = await import("../../src/helpers/lectureOverview.ts");
  const notes = Array.from({ length: 151 }, (_, id) => ({
    id,
    title: `Note ${id}`,
    folder_id: id % 3,
    deleted_at: null,
    lecture_data: JSON.stringify({
      tasks: [{ text: `Tugas ${id}`, status: "review" }],
      quizzes: [],
      exams: [],
    }),
  }));
  const groups = collectLectureGroups(notes, "tasks");
  assert.equal(groups.length, 151);
  assert.equal(groups.at(-1).note.id, 150);
  assert.equal(groups.at(-1).items[0].text, "Tugas 150");
  assert.equal(groups[2].note.folder_id, 2);
});

test("overview excludes deleted, empty and malformed notes without mixing assessment types", async () => {
  const { collectLectureGroups } = await import("../../src/helpers/lectureOverview.ts");
  const active = {
    id: 1,
    title: "Aljabar",
    deleted_at: null,
    lecture_data: JSON.stringify({
      tasks: [{ text: "Latihan", status: "approved" }],
      quizzes: [{ text: "Quiz besok", status: "review" }],
      exams: [{ text: "UTS", status: "cancelled" }],
    }),
  };
  const notes = [
    active,
    { ...active, id: 2, deleted_at: "2026-11-01" },
    { ...active, id: 3, lecture_data: "{" },
    { ...active, id: 4, lecture_data: null },
    { ...active, id: 5, lecture_data: JSON.stringify({ tasks: [] }) },
  ];
  for (const [collection, expected] of [
    ["tasks", "Latihan"],
    ["quizzes", "Quiz besok"],
    ["exams", "UTS"],
  ]) {
    const groups = collectLectureGroups(notes, collection);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].note.id, 1);
    assert.equal(groups[0].items[0].text, expected);
  }
  assert.equal(collectLectureGroups([], "quizzes").length, 0);
});
