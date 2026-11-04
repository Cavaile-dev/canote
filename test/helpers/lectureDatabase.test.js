const test = require("node:test");
const assert = require("node:assert/strict");
const { createDb } = require("./harness/db.js");
const DatabaseManager = require("../../src/helpers/database.js");

test("lecture data and task review decisions persist across database reopen", (t) => {
  const db = createDb(t);
  if (!db) return;
  const saved = db.saveNote("Kuliah", "", "personal");
  assert.equal(saved.success, true);
  const lecture_data = JSON.stringify({
    notes: "Catatan",
    highlights: [],
    tasks: [{ text: "Soal 1", status: "approved" }],
  });
  assert.equal(db.updateNote(saved.note.id, { lecture_data }).success, true);
  db.db.close();
  const reopened = new DatabaseManager();
  try {
    assert.equal(reopened.getNote(saved.note.id).lecture_data, lecture_data);
  } finally {
    reopened.db.close();
  }
});
