const test = require("node:test");
const assert = require("node:assert/strict");
const { createDb } = require("./harness/db");
const { isCanoteAction } = require("../../src/helpers/builtinActions");

test("Canote seeds only Personal and exposes the requested template and four actions", (t) => {
  const db = createDb(t);
  if (!db) return;
  assert.deepEqual(
    db
      .getFolders()
      .filter((f) => f.is_default)
      .map((f) => f.name),
    ["Personal"]
  );
  const actions = db.getActions().filter(isCanoteAction);
  assert.equal(actions.length, 5);
  assert.deepEqual(
    actions.filter((a) => a.kind === "template").map((a) => a.name),
    ["AI Summary"]
  );
  assert.deepEqual(
    actions.filter((a) => a.kind === "action").map((a) => a.name),
    ["Create to-dos", "Make notes shorter", "Make notes longer", "Create outline"]
  );
  const custom = db.createAction("Custom", "", "My instructions").action;
  assert.equal(isCanoteAction(custom), false);
  assert.ok(db.getAction(custom.id), "hidden custom prompts remain stored");
  assert.equal(
    db.saveNote("New recording", "Transcript", "meeting").note.folder_id,
    db.getMeetingsFolder().id
  );
});

test("retiring stock folders preserves notes and custom folders", (t) => {
  const db = createDb(t);
  if (!db) return;
  const personal = db.getFolders().find((f) => f.name === "Personal");
  const meetings = db.createFolder("Meetings", personal.space_id).folder;
  const videos = db.createFolder("Videos", personal.space_id).folder;
  db.db.prepare("UPDATE folders SET is_default = 1 WHERE id IN (?, ?)").run(meetings.id, videos.id);
  const first = db.saveNote("Lecture", "Preserve me", "personal", null, null, meetings.id).note;
  const second = db.saveNote("Import", "Also preserve me", "upload", null, null, videos.id).note;
  const custom = db.createFolder("My folder", personal.space_id).folder;
  db.retireCanoteDefaultFolders();
  db.retireCanoteDefaultFolders();
  assert.equal(db.getNote(first.id).folder_id, personal.id);
  assert.equal(db.getNote(first.id).content, "Preserve me");
  assert.equal(db.getNote(second.id).folder_id, personal.id);
  assert.equal(db.getNote(second.id).deleted_at, null);
  assert.ok(db.getFolders().some((f) => f.id === custom.id));
  assert.ok(!db.getFolders().some((f) => [meetings.id, videos.id].includes(f.id)));
});
