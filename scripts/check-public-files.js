const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { publicFileIssues, secretKinds } = require("./lib/public-files");

const staged = process.argv.includes("--staged");
const git = (...args) =>
  execFileSync("git", ["-c", `safe.directory=${process.cwd().replace(/\\/g, "/")}`, ...args], {
    maxBuffer: 256 * 1024 * 1024,
  });
const files = git(
  ...(staged
    ? ["ls-files", "--cached", "-z"]
    : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
)
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const issues = [];
for (const file of new Set(files)) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) {
    issues.push(...publicFileIssues(file, Buffer.alloc(0)));
    continue;
  }
  if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
    if (fs.statSync(absolute).size > 100 * 1024 * 1024)
      issues.push(`${file}: exceeds GitHub's 100 MiB limit`);
    issues.push(...publicFileIssues(file, fs.readFileSync(absolute)));
  }
}
if (staged) {
  const addedText = git("diff", "--cached", "--no-ext-diff", "--no-color", "--unified=0")
    .toString("utf8")
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
  for (const kind of secretKinds(addedText)) issues.push(`Git index: possible ${kind}`);
}
if (issues.length) {
  console.error(`Public file check failed (${issues.length} findings):\n${issues.join("\n")}`);
  process.exitCode = 1;
} else
  console.log(
    `Public file check passed: ${new Set(files).size} files; credentials were not printed.`
  );
