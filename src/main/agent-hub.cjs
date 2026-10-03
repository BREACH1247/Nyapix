const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { cleanText } = require("./agent-relay.cjs");
const PROVIDERS = ["claude", "codex", "cursor"];
const ACTIVE = ["thinking", "responding", "waiting"];
const PHASES = [...ACTIVE, "done", "error", "interrupted", "idle"];

class AgentHub {
  constructor({
    onChange = () => {},
    getSettings = () => ({}),
    now = Date.now,
  } = {}) {
    this.sessions = new Map();
    this.history = [];
    this.onChange = onChange;
    this.getSettings = getSettings;
    this.now = now;
  }
  ingest(raw) {
    if (
      !raw ||
      !PROVIDERS.includes(raw.provider) ||
      !PHASES.includes(raw.phase) ||
      this.getSettings().agentEnabled === false
    )
      return false;
    const session = cleanText(raw.session, 160) || "default";
    const key = `${raw.provider}:${session}`,
      prev = this.sessions.get(key);
    const at = Number.isFinite(raw.at)
      ? Math.min(raw.at, this.now())
      : this.now();
    if (this.now() - at > 30000 || (prev && at < prev.at)) return false;
    const turn = cleanText(raw.turn, 160);
    if (
      prev?.turn &&
      turn &&
      prev.turn !== turn &&
      !raw.start &&
      ACTIVE.includes(prev.phase)
    )
      return false;
    if (
      prev?.phase === "done" &&
      raw.phase === "done" &&
      prev.turn === turn &&
      !raw.start
    )
      return false;
    const text =
      this.getSettings().agentShowOutput === false ? "" : cleanText(raw.text);
    const event = {
      activity: ["editing", "testing", "thinking"].includes(raw.activity) ? raw.activity : "thinking",
      provider: raw.provider,
      session,
      turn,
      phase: raw.phase,
      at,
      text: text || (!raw.start && prev?.turn === turn ? prev?.text || "" : ""),
    };
    this.sessions.set(key, event);
    if (this.sessions.size > 100)
      this.sessions.delete(this.sessions.keys().next().value);
    if (
      ["done", "error", "interrupted", "responding", "waiting"].includes(
        event.phase,
      )
    ) {
      this.history.unshift({ ...event, id: crypto.randomUUID() });
      this.history = this.history.slice(0, 20);
    }
    this.onChange(this.snapshot(), event);
    return true;
  }
  snapshot() {
    const events = [...this.sessions.values()].sort((a, b) => b.at - a.at);
    const active = events.filter((e) => ACTIVE.includes(e.phase));
    const focus = active.find((e) => e.phase === "waiting") ||
      active[0] ||
      events[0] || { phase: "idle" };
    return {
      focus,
      activeCount: active.length,
      sessions: events,
      history: this.history,
    };
  }
  expire() {
    let changed = false;
    for (const [key, event] of this.sessions) {
      if (
        ACTIVE.includes(event.phase) &&
        this.now() - event.at > 30 * 60 * 1000
      ) {
        this.sessions.set(key, { ...event, phase: "idle", stale: true });
        changed = true;
      }
    }
    if (changed) this.onChange(this.snapshot());
  }
  clear() {
    this.sessions.clear();
    this.history = [];
    this.onChange(this.snapshot());
  }
  disconnect(provider) {
    for (const [key, event] of this.sessions)
      if (event.provider === provider) this.sessions.delete(key);
    this.onChange(this.snapshot());
  }
  redact() {
    for (const event of this.sessions.values()) event.text = "";
    for (const event of this.history) event.text = "";
    this.onChange(this.snapshot());
  }
}

async function startAgentBridge(hub, { home = os.homedir() } = {}) {
  const token = crypto.randomBytes(32).toString("hex");
  const dir = path.join(home, ".nyapix"),
    descriptor = path.join(dir, "bridge.json");
  const server = http.createServer((req, res) => {
    const auth = Buffer.from(req.headers.authorization || ""),
      expected = Buffer.from(`Bearer ${token}`);
    if (
      req.headers.origin ||
      auth.length !== expected.length ||
      !crypto.timingSafeEqual(auth, expected)
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (req.method !== "POST" || req.url !== "/events") {
      res.writeHead(404);
      res.end();
      return;
    }
    let bytes = 0,
      chunks = [];
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 8192) {
        res.writeHead(413);
        res.end();
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const accepted = hub.ingest(
          JSON.parse(Buffer.concat(chunks).toString("utf8")),
        );
        res.writeHead(accepted ? 204 : 202);
      } catch {
        res.writeHead(400);
      }
      res.end();
    });
    req.on("error", () => {});
  });
  server.requestTimeout = 2500;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      descriptor,
      JSON.stringify({ port: server.address().port, token }),
      { mode: 0o600 },
    );
  } catch (error) {
    server.close();
    throw error;
  }
  const timer = setInterval(() => hub.expire(), 30000);
  return {
    port: server.address().port,
    token,
    stop: () => {
      clearInterval(timer);
      server.close();
      try {
        if (JSON.parse(fs.readFileSync(descriptor, "utf8")).token === token)
          fs.unlinkSync(descriptor);
      } catch {
        /* Already removed. */
      }
    },
  };
}
module.exports = { AgentHub, startAgentBridge, PROVIDERS };
