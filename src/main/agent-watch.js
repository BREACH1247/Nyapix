const os = require("os");
const fs = require("fs");
const path = require("path");

const QUIET_MS = 14000;
const POLL_MS = 700;
const RESCAN_MS = 5000;
const SETTLE_MS = 5000;
const MIN_THINK_MS = 2500;

function dirs() {
  const home = os.homedir();
  return [
    path.join(home, ".cursor", "projects"),
    path.join(home, ".claude", "projects"),
    path.join(home, ".claude"),
    path.join(home, ".codex"),
    path.join(home, ".kiro"),
    path.join(home, ".gemini"),
    path.join(home, ".antigravity"),
  ];
}

function interesting(filePath) {
  const n = String(filePath || "").replace(/\\/g, "/").toLowerCase();
  if (n.endsWith(".jsonl")) return true;
  if (n.includes("agent-transcript")) return true;
  if (n.includes("agent-tools")) return true;
  if (n.includes("/transcripts/") && (n.endsWith(".json") || n.endsWith(".txt") || n.endsWith(".jsonl"))) return true;
  return false;
}

function skipDir(name) {
  return (
    name === "node_modules" ||
    name === ".git" ||
    name === "Cache" ||
    name === "GPUCache" ||
    name === "Code Cache" ||
    name === "CachedData" ||
    name === "assets"
  );
}

function collectFiles(root, acc, depth = 0) {
  if (!root || depth > 8 || acc.length > 800) return;
  let ents;
  try {
    ents = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of ents) {
    if (skipDir(e.name)) continue;
    const p = path.join(root, e.name);
    if (e.isDirectory()) collectFiles(p, acc, depth + 1);
    else if (interesting(p)) acc.push(p);
  }
}

function startAgentWatch(onStatus) {
  const watchers = [];
  const snapshots = new Map();
  let lastHit = 0;
  let thinkStarted = 0;
  let thinking = false;
  let quietTimer = null;
  let idleTimer = null;
  let cooldownUntil = 0;
  let primed = false;
  let files = [];
  let lastScan = 0;

  const clearTimers = () => {
    clearTimeout(quietTimer);
    clearTimeout(idleTimer);
    quietTimer = null;
    idleTimer = null;
  };

  const bump = () => {
    const now = Date.now();
    if (now < cooldownUntil) return;
    lastHit = now;
    if (!thinking) {
      thinking = true;
      thinkStarted = now;
      onStatus("think");
    }
    clearTimers();
    quietTimer = setTimeout(settle, QUIET_MS);
  };

  const settle = () => {
    if (!thinking) return;
    if (Date.now() - lastHit < QUIET_MS - 80) return;
    const lasted = Date.now() - thinkStarted;
    thinking = false;
    cooldownUntil = Date.now() + SETTLE_MS;
    clearTimers();
    if (lasted < MIN_THINK_MS) {
      onStatus("idle");
      return;
    }
    onStatus("done");
    idleTimer = setTimeout(() => {
      onStatus("idle");
      idleTimer = null;
    }, 2200);
  };

  const scan = () => {
    const next = [];
    for (const dir of dirs()) {
      if (!fs.existsSync(dir)) continue;
      collectFiles(dir, next);
    }
    files = next;
    lastScan = Date.now();
  };

  const poll = () => {
    if (Date.now() - lastScan > RESCAN_MS) scan();
    let changed = false;
    for (const file of files) {
      let st;
      try {
        st = fs.statSync(file);
      } catch {
        snapshots.delete(file);
        continue;
      }
      const prev = snapshots.get(file);
      snapshots.set(file, { size: st.size, mtime: st.mtimeMs });
      if (!prev) {
        if (primed) changed = true;
        continue;
      }
      if (st.size !== prev.size || st.mtimeMs !== prev.mtime) changed = true;
    }
    if (changed) bump();
    primed = true;
  };

  scan();
  poll();

  const pollTimer = setInterval(poll, POLL_MS);

  for (const dir of dirs()) {
    try {
      if (!fs.existsSync(dir)) continue;
      const watcher = fs.watch(dir, { recursive: true }, (_event, filename) => {
        if (filename && interesting(String(filename))) bump();
      });
      watchers.push(watcher);
    } catch {
      /* folder missing or watch denied */
    }
  }

  return () => {
    clearTimers();
    clearInterval(pollTimer);
    for (const w of watchers) {
      try {
        w.close();
      } catch {
        /* ignore */
      }
    }
  };
}

module.exports = { startAgentWatch };
