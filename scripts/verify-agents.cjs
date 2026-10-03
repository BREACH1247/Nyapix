const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { spawnSync } = require("node:child_process");
const { normalize, relay } = require("../src/main/agent-relay.cjs");
const { AgentHub, startAgentBridge } = require("../src/main/agent-hub.cjs");
const {
  setIntegration,
  integrationStatus,
} = require("../src/main/agent-install.cjs");

test("official payloads become states without forwarding thoughts or prompts", () => {
  assert.equal(
    normalize("claude", {
      hook_event_name: "UserPromptSubmit",
      session_id: "a",
      prompt: "private",
    }).phase,
    "thinking",
  );
  assert.equal(
    normalize("codex", {
      hook_event_name: "Stop",
      session_id: "a",
      turn_id: "t",
      last_assistant_message: "Ready.",
    }).text,
    "Ready.",
  );
  const thought = normalize("cursor", {
    hook_event_name: "afterAgentThought",
    conversation_id: "a",
    generation_id: "t",
    text: "private reasoning",
  });
  assert.equal(thought.phase, "thinking");
  assert.equal(thought.text, "");
  assert(!JSON.stringify(thought).includes("private"));
  assert.equal(
    normalize("cursor", {
      hook_event_name: "afterAgentResponse",
      text: "The fix is ready.",
    }).phase,
    "responding",
  );
  assert.equal(
    normalize("claude", { hook_event_name: "PermissionRequest" }).phase,
    "waiting",
  );
  assert.equal(
    normalize("claude", {
      hook_event_name: "StopFailure",
      last_assistant_message: "private error details",
    }).text,
    "",
  );
  assert.equal(
    normalize("cursor", { hook_event_name: "stop", status: "aborted" }).phase,
    "interrupted",
  );
  assert.equal(
    normalize("cursor", { hook_event_name: "stop", status: "error" }).phase,
    "error",
  );
  assert.equal(
    normalize("codex", { hook_event_name: "Interrupt" }).phase,
    "interrupted",
  );
  assert.equal(normalize("codex", { hook_event_name: "SubagentStop" }), null);
});

test("concurrent sessions, new turns, duplicate completions and privacy", () => {
  let now = 100000,
    settings = {};
  const hub = new AgentHub({ now: () => now, getSettings: () => settings });
  const send = (provider, phase, extra = {}) =>
    hub.ingest({ provider, phase, session: provider, at: ++now, ...extra });
  send("claude", "thinking", { start: true });
  send("codex", "thinking", { start: true });
  send("claude", "done", { text: "Ready" });
  assert.equal(hub.snapshot().focus.provider, "codex");
  assert.equal(hub.snapshot().activeCount, 1);
  assert.equal(send("claude", "done", { text: "Ready" }), false);
  send("codex", "waiting");
  assert.equal(hub.snapshot().focus.phase, "waiting");
  send("claude", "thinking", { start: true });
  assert.equal(
    hub.snapshot().sessions.find((e) => e.provider === "claude").text,
    "",
  );
  const old = now - 100;
  assert.equal(
    hub.ingest({ provider: "codex", phase: "done", session: "codex", at: old }),
    false,
  );
  now += 31 * 60 * 1000;
  hub.expire();
  assert.equal(hub.snapshot().activeCount, 0);
  assert.notEqual(
    hub.snapshot().focus.phase,
    "done",
    "Silence must not mean success",
  );
  settings = { agentShowOutput: false };
  hub.redact();
  send("claude", "responding", { text: "private reply" });
  assert(!JSON.stringify(hub.snapshot()).includes("private reply"));
  assert(hub.snapshot().history.every((e) => !e.text));
  settings = { agentEnabled: false };
  hub.clear();
  assert.equal(send("cursor", "thinking"), false);
  assert.equal(hub.snapshot().sessions.length, 0);
});

test("install, repeat and disconnect preserve unrelated user hooks and backups", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "nyapix-install-"));
  try {
    for (const provider of ["claude", "codex", "cursor"]) {
      const file = path.join(
        home,
        provider === "claude"
          ? ".claude/settings.json"
          : `.${provider}/hooks.json`,
      );
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const keep =
        provider === "cursor"
          ? { command: "echo keep-me" }
          : { hooks: [{ type: "command", command: "echo keep-me" }] };
      const original = {
        custom: { keep: true },
        hooks: { [provider === "cursor" ? "stop" : "Stop"]: [keep] },
      };
      fs.writeFileSync(file, JSON.stringify(original));
      setIntegration(provider, true, { home, checkNode: false });
      const once = fs.readFileSync(file, "utf8");
      setIntegration(provider, true, { home, checkNode: false });
      assert.equal(fs.readFileSync(file, "utf8"), once);
      assert(
        integrationStatus(home).find((p) => p.provider === provider).installed,
      );
      setIntegration(provider, false, { home, checkNode: false });
      const after = JSON.parse(fs.readFileSync(file, "utf8"));
      assert.deepEqual(after.hooks, original.hooks);
      assert.deepEqual(after.custom, original.custom);
      assert(
        fs
          .readdirSync(path.dirname(file))
          .some((name) => name.includes("nyapix-backup")),
      );
    }
    const invalid = path.join(home, ".codex/hooks.json");
    fs.writeFileSync(invalid, "broken json");
    assert.throws(
      () => setIntegration("codex", true, { home, checkNode: false }),
      /valid JSON/,
    );
    assert.equal(fs.readFileSync(invalid, "utf8"), "broken json");
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

function request(port, token, origin) {
  return new Promise((resolve, reject) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (origin) headers.Origin = origin;
    const req = http.request(
      { hostname: "127.0.0.1", port, path: "/events", method: "POST", headers },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      },
    );
    req.on("error", reject);
    req.end("{}");
  });
}

test("real local HTTP relay delivers hook events and rejects unauthorized callers", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "nyapix-bridge-"));
  const hub = new AgentHub();
  const bridge = await startAgentBridge(hub, { home });
  try {
    assert.equal(await request(bridge.port), 403);
    assert.equal(
      await request(bridge.port, bridge.token, "http://untrusted.test"),
      403,
    );
    for (const provider of ["claude", "codex", "cursor"]) {
      await relay(
        provider,
        {
          hook_event_name:
            provider === "cursor" ? "beforeSubmitPrompt" : "UserPromptSubmit",
          session_id: provider,
        },
        home,
      );
    }
    assert.equal(hub.snapshot().activeCount, 3);
    await relay(
      "cursor",
      {
        hook_event_name: "afterAgentResponse",
        session_id: "cursor",
        text: "<b>Literal reply</b>",
      },
      home,
    );
    await relay(
      "cursor",
      { hook_event_name: "stop", status: "completed", session_id: "cursor" },
      home,
    );
    assert.equal(hub.snapshot().activeCount, 2);
    assert.equal(hub.snapshot().history[0].text, "<b>Literal reply</b>");
    assert(
      !fs
        .readdirSync(path.join(home, ".nyapix"))
        .some((name) => /history|transcript/.test(name)),
    );
  } finally {
    bridge.stop();
    fs.rmSync(home, { recursive: true, force: true });
  }
  const child = spawnSync(
    process.execPath,
    [path.join(__dirname, "../src/main/agent-relay.cjs"), "codex"],
    { input: "invalid", encoding: "utf8", timeout: 4000, windowsHide: true },
  );
  assert.equal(child.status, 0);
  assert.equal(child.stdout.trim(), "{}");
});
