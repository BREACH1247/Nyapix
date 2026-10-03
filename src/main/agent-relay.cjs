#!/usr/bin/env node
// Standalone, observational hook. Never emits approval decisions or follow-ups.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");

function cleanText(value, limit = 800) {
  return typeof value === "string"
    ? value
        .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "")
        .trim()
        .slice(0, limit)
    : "";
}

function normalize(provider, input, at = Date.now()) {
  if (
    !["claude", "codex", "cursor"].includes(provider) ||
    !input ||
    typeof input !== "object"
  )
    return null;
  const name = input.hook_event_name;
  let phase,
    text = "",
    start = false;
  if (["UserPromptSubmit", "beforeSubmitPrompt"].includes(name)) {
    phase = "thinking";
    start = true;
  } else if (
    [
      "PreToolUse",
      "PostToolUse",
      "preToolUse",
      "postToolUse",
      "afterAgentThought",
    ].includes(name)
  )
    phase = "thinking";
  else if (name === "afterAgentResponse") {
    phase = "responding";
    text = cleanText(input.text);
  } else if (
    ["PermissionRequest"].includes(name) ||
    (name === "Notification" && input.notification_type === "permission_prompt")
  )
    phase = "waiting";
  else if (["Stop", "stop"].includes(name)) {
    phase =
      input.status === "error"
        ? "error"
        : input.status === "aborted"
          ? "interrupted"
          : "done";
    if (phase === "done") text = cleanText(input.last_assistant_message);
  } else if (name === "StopFailure") phase = "error";
  else if (name === "Interrupt") phase = "interrupted";
  else if (["SessionEnd", "sessionEnd"].includes(name)) phase = "idle";
  else return null;
  // Derive a small activity label; never forward commands or tool arguments.
  const tool = cleanText(input.tool_name || input.tool?.name, 80).toLowerCase();
  const command = cleanText(input.tool_input?.command || input.tool_input?.cmd, 4096);
  const activity = phase !== "thinking" ? "" : /edit|write|apply_patch/.test(tool) ? "editing"
    : /test/.test(tool) || (/shell|bash|exec_command/.test(tool) && /\b(pytest|jest|vitest|cargo test|go test|npm (run )?test|pnpm test)\b/i.test(command)) ? "testing" : "thinking";
  // Deliberately do not copy prompts, tool inputs, transcript paths or thoughts.
  return {
    activity,
    provider,
    phase,
    text,
    start,
    at,
    session: cleanText(
      input.conversation_id || input.session_id || "default",
      160,
    ),
    turn: cleanText(input.generation_id || input.turn_id, 160),
    event: name,
  };
}

async function relay(provider, input, home = os.homedir()) {
  const event = normalize(provider, input);
  if (!event) return;
  let config;
  try {
    config = JSON.parse(
      fs.readFileSync(path.join(home, ".nyapix", "bridge.json"), "utf8"),
    );
  } catch {
    return;
  }
  if (
    !Number.isInteger(config.port) ||
    config.port < 1 ||
    config.port > 65535 ||
    typeof config.token !== "string"
  )
    return;
  const body = JSON.stringify(event);
  await new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: config.port,
        path: "/events",
        method: "POST",
        timeout: 750,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${config.token}`,
        },
      },
      (res) => {
        res.resume();
        res.on("end", resolve);
      },
    );
    req.on("error", resolve);
    req.on("timeout", () => req.destroy());
    req.end(body);
  });
}

function runCli(provider, finished = () => {}) {
  let input = "",
    size = 0;
  const deadline = setTimeout(() => {
    process.stdout.write("{}\n");
    process.exit(0);
  }, 1800);
  // Electron's Windows GUI bootstrap substitutes process.stdin with an empty
  // stream. Read the inherited descriptor directly while keeping reads async.
  const stdin = process.versions.electron && process.platform === "win32"
    ? fs.createReadStream(null, { fd: 0, autoClose: false }) : process.stdin;
  stdin.on("error", () => {
    clearTimeout(deadline);
    process.stdout.write("{}\n", finished);
  });
  stdin.setEncoding("utf8");
  stdin.on("data", (chunk) => {
    size += Buffer.byteLength(chunk);
    if (size <= 1024 * 1024) input += chunk;
  });
  stdin.on("end", async () => {
    try {
      if (size <= 1024 * 1024) await relay(provider, JSON.parse(input));
    } catch {
      /* Fail open. */
    }
    clearTimeout(deadline);
    process.stdout.write("{}\n", finished);
  });
}
if (require.main === module) runCli(process.argv[2]);
module.exports = { normalize, cleanText, relay, runCli };
