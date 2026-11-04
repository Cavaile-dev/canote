const test = require("node:test");
const assert = require("node:assert/strict");

test("calendar groups note creation dates in local time and excludes deleted or invalid notes", async (t) => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "Asia/Jakarta";
  t.after(() => {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  });
  const { notesByCreatedDay } = await import("../../src/helpers/noteDates.ts");
  const notes = [
    { id: 1, created_at: "2026-11-04 17:30:00", updated_at: "2026-11-10 01:00:00" },
    { id: 2, created_at: "2026-11-05T02:00:00+07:00" },
    { id: 3, created_at: "2026-11-04T23:59:00+07:00" },
    { id: 4, created_at: "2026-11-05 08:00:00", deleted_at: "2026-11-06" },
    { id: 5, created_at: "bad date" },
  ];
  const groups = notesByCreatedDay(notes);
  assert.deepEqual([...groups.keys()], ["2026-11-05", "2026-11-04"]);
  assert.deepEqual(
    groups.get("2026-11-05").map((note) => note.id),
    [2, 1]
  );
  assert.deepEqual(
    groups.get("2026-11-04").map((note) => note.id),
    [3]
  );
  assert.deepEqual(
    notes.map((note) => note.id),
    [1, 2, 3, 4, 5]
  );
});
