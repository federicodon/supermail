// `npm run live` — start the SuperMail UI (Vite) and the live sync bridge
// together, with prefixed output, and tear both down on Ctrl-C.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const procs = [
  { name: "ui    ", cmd: npx, args: ["vite"], color: "\x1b[36m" },
  { name: "bridge", cmd: process.execPath, args: ["server/index.mjs"], color: "\x1b[35m" },
];

const children = [];
let shuttingDown = false;

function prefix(name, color, chunk) {
  const reset = "\x1b[0m";
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line.length) process.stdout.write(`${color}[${name}]${reset} ${line}\n`);
  }
}

for (const p of procs) {
  const child = spawn(p.cmd, p.args, { cwd: root, env: process.env });
  child.stdout.on("data", (d) => prefix(p.name, p.color, d));
  child.stderr.on("data", (d) => prefix(p.name, p.color, d));
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.log(`[launch] ${p.name.trim()} exited (${code}); shutting down.`);
      shutdown();
    }
  });
  children.push(child);
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(0), 300);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
console.log("[launch] starting SuperMail UI + live Gmail bridge… (Ctrl-C to stop)");
