const fs = require("node:fs");
const path = require("node:path");

function isPrivatePath(file) {
  const normalized = file.replace(/\\/g, "/");
  return (
    /(?:^|\/)(?:\.env[^/]*|secure-keys|userData|Local Storage|graphify-out|\.codex|\.agents)(?:\/|$)/i.test(
      normalized
    ) || /\.(?:db(?:-.*)?|sqlite3?(?:-.*)?|enc|key|pem|p12|pfx|keystore|jks)$/i.test(normalized)
  );
}

// Report categories only: credentials must never be echoed to CI logs.
function secretKinds(contents) {
  const text = Buffer.isBuffer(contents) ? contents.toString("utf8") : contents;
  return [
    ["OpenAI-style API key", /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/],
    ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
    ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
    ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{24,}\b/],
    ["private key", /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  ]
    .filter(([, pattern]) => pattern.test(text))
    .map(([kind]) => kind);
}

function publicFileIssues(file, contents) {
  const issues = isPrivatePath(file) ? [`${file}: private/local file`] : [];
  if (!Buffer.isBuffer(contents) || !contents.includes(0)) {
    for (const kind of secretKinds(contents)) issues.push(`${file}: possible ${kind}`);
  }
  return issues;
}

function assertPublicPackage(resourcesDir) {
  const asar = require("@electron/asar");
  const archive = path.join(resourcesDir, "app.asar");
  const issues = [];
  for (const entry of asar.listPackage(archive)) {
    const file = entry.replace(/^[/\\]+/, "");
    if (isPrivatePath(file)) issues.push(`${file}: private/local file in app.asar`);
    // Third-party code is not application configuration; inspect first-party text.
    if (/^(?:main\.js|preload\.js|package\.json|src\/.*\.(?:js|ts|json|css|html))$/.test(file)) {
      issues.push(...publicFileIssues(file, asar.extractFile(archive, file)));
    }
  }
  const queue = [resourcesDir];
  while (queue.length) {
    const current = queue.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(resourcesDir, absolute).replace(/\\/g, "/");
      if (entry.isDirectory()) queue.push(absolute);
      else if (entry.isFile() && entry.name !== "app.asar") {
        if (isPrivatePath(relative)) issues.push(`${relative}: private/local resource`);
        if (
          !relative.includes("node_modules/") &&
          /\.(?:js|ts|json|css|html|yml)$/.test(relative)
        ) {
          issues.push(...publicFileIssues(relative, fs.readFileSync(absolute)));
        }
      }
    }
  }
  if (issues.length) throw new Error(`Public package check failed:\n${issues.join("\n")}`);
}

module.exports = { isPrivatePath, secretKinds, publicFileIssues, assertPublicPackage };
