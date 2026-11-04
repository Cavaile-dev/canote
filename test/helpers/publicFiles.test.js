const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const {
  isPrivatePath,
  secretKinds,
  assertPublicPackage,
} = require("../../scripts/lib/public-files");

test("public files exclude env variants, local databases and encrypted credentials", () => {
  for (const file of [
    ".env",
    ".env.local",
    "src/.env.production",
    "secure-keys/OPENAI_API_KEY.enc",
    "transcriptions.db-wal",
    "keys/signing.pfx",
    "notes.sqlite3",
    "graphify-out/graph.json",
  ]) {
    assert.equal(isPrivatePath(file), true, file);
  }
  for (const file of [
    "README.md",
    "src/config/secretKeys.js",
    "test/helpers/secretKeys.test.js",
    "src/assets/icon.png",
  ])
    assert.equal(isPrivatePath(file), false, file);
});

test("secret findings report the type without returning the credential", () => {
  const token = "ghp_" + "A".repeat(36);
  assert.deepEqual(secretKinds(token), ["GitHub token"]);
  assert.ok(!secretKinds(token).join().includes(token));
  assert.deepEqual(secretKinds("apiKey: process.env.OPENAI_API_KEY"), []);
});

test("the packed application is rejected if an env file is in app.asar", async (t) => {
  const asar = require("@electron/asar");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "canote-public-package-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  const resources = path.join(root, "resources");
  fs.mkdirSync(source);
  fs.mkdirSync(resources);
  fs.writeFileSync(path.join(source, "main.js"), "console.log('Canote');");
  fs.writeFileSync(path.join(source, ".env"), "EXAMPLE=not-a-secret");
  await asar.createPackage(source, path.join(resources, "app.asar"));
  assert.throws(() => assertPublicPackage(resources), /private\/local file/);
});

test("a public package passes and a loose encrypted key fails", async (t) => {
  const asar = require("@electron/asar");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "canote-clean-package-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "source");
  const resources = path.join(root, "resources");
  fs.mkdirSync(source);
  fs.mkdirSync(resources);
  fs.writeFileSync(path.join(source, "main.js"), "console.log('Canote');");
  await asar.createPackage(source, path.join(resources, "app.asar"));
  assert.doesNotThrow(() => assertPublicPackage(resources));
  fs.mkdirSync(path.join(resources, "secure-keys"));
  fs.writeFileSync(path.join(resources, "secure-keys", "key.enc"), "test data");
  assert.throws(() => assertPublicPackage(resources), /private\/local resource/);
});

test("Windows publishing uses Canote and has no upstream signing identity or env resources", () => {
  const config = require("../../electron-builder.json");
  assert.equal(config.publish.owner, "Cavaile-dev");
  assert.equal(config.publish.repo, "canote");
  assert.equal(config.win.azureSignOptions, undefined);
  assert.equal(config.extraResources.includes(".env"), false);
  assert.ok(config.files.includes("!**/.env*"));
});

test("the staged check detects a token even if the working copy was cleaned afterwards", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "canote-staged-secret-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  const token = "ghp_" + "B".repeat(36);
  const file = path.join(root, "main.js");
  fs.writeFileSync(file, `const token = '${token}';`);
  execFileSync("git", ["-c", `safe.directory=${root.replace(/\\/g, "/")}`, "add", "main.js"], {
    cwd: root,
  });
  fs.writeFileSync(file, "console.log('clean working copy');");
  const result = spawnSync(
    process.execPath,
    [path.resolve(__dirname, "../../scripts/check-public-files.js"), "--staged"],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Git index: possible GitHub token/);
  assert.ok(!result.stderr.includes(token));
});

test("an env file staged and then removed locally remains blocked", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "canote-staged-env-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  const file = path.join(root, ".env.production");
  fs.writeFileSync(file, "EXAMPLE=not-a-secret");
  execFileSync(
    "git",
    ["-c", `safe.directory=${root.replace(/\\/g, "/")}`, "add", ".env.production"],
    { cwd: root }
  );
  fs.unlinkSync(file);
  const result = spawnSync(
    process.execPath,
    [path.resolve(__dirname, "../../scripts/check-public-files.js"), "--staged"],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\.env.production: private\/local file/);
});
