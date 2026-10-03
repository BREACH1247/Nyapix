const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

const SPECS = {
  claude: {
    file: [".claude", "settings.json"],
    events: [
      "UserPromptSubmit",
      "PreToolUse",
      "PostToolUse",
      "PermissionRequest",
      "Stop",
      "StopFailure",
      "SessionEnd",
    ],
  },
  codex: {
    file: [".codex", "hooks.json"],
    events: [
      "UserPromptSubmit",
      "PreToolUse",
      "PostToolUse",
      "PermissionRequest",
      "Stop",
      "Interrupt",
      "SessionEnd",
    ],
  },
  cursor: {
    file: [".cursor", "hooks.json"],
    events: [
      "beforeSubmitPrompt",
      "preToolUse",
      "postToolUse",
      "afterAgentThought",
      "afterAgentResponse",
      "stop",
      "sessionEnd",
    ],
  },
};
const ownHook = (hook) =>
  typeof hook?.command === "string" &&
  (hook.command.includes("nyapix-agent-relay.cjs") || hook.command.includes("--nyapix-agent-relay"));
function stripHooks(config, provider) {
  const result = structuredClone(config);
  for (const [name, groups] of Object.entries(result.hooks || {})) {
    if (!Array.isArray(groups))
      throw new Error(
        `Invalid hooks for ${name}. Please check the existing configuration.`,
      );
    result.hooks[name] =
      provider === "cursor"
        ? groups.filter((g) => !ownHook(g))
        : groups
            .map((g) => ({
              ...g,
              hooks: Array.isArray(g.hooks)
                ? g.hooks.filter((h) => !ownHook(h))
                : g.hooks,
            }))
            .filter((g) => !Array.isArray(g.hooks) || g.hooks.length);
    if (!result.hooks[name].length) delete result.hooks[name];
  }
  return result;
}
function readConfig(file) {
  if (!fs.existsSync(file)) return {};
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(
      "Existing configuration isn't valid JSON. It has not been changed.",
    );
  }
  if (
    !config ||
    typeof config !== "object" ||
    Array.isArray(config) ||
    (config.hooks &&
      (typeof config.hooks !== "object" || Array.isArray(config.hooks)))
  )
    throw new Error("Unsupported hook configuration. It has not been changed.");
  return config;
}
function integrationStatus(home = os.homedir()) {
  return Object.entries(SPECS).map(([provider, spec]) => {
    const file = path.join(home, ...spec.file);
    try {
      const config = readConfig(file);
      const installed = spec.events.every((name) =>
        (config.hooks?.[name] || []).some((group) =>
          provider === "cursor" ? ownHook(group) : group.hooks?.some(ownHook),
        ),
      );
      const relay = path.join(home, ".nyapix", "nyapix-agent-relay.cjs");
      const updateAvailable = installed && (!fs.existsSync(relay) || fs.readFileSync(relay, "utf8") !== fs.readFileSync(path.join(__dirname, "agent-relay.cjs"), "utf8"));
      return { provider, installed, updateAvailable, file };
    } catch (error) {
      return { provider, installed: false, file, error: error.message };
    }
  });
}
function setIntegration(
  provider,
  enabled,
  { home = os.homedir(), checkNode = true, runtimePath = null } = {},
) {
  const spec = SPECS[provider];
  if (!spec) throw new Error("Unknown integration");
  if (
    enabled &&
    !runtimePath &&
    checkNode &&
    spawnSync("node", ["--version"], { windowsHide: true, timeout: 3000 })
      .status !== 0
  )
    throw new Error(
      "Install Node.js to connect your coding agents, then try again.",
    );
  const file = path.join(home, ...spec.file);
  const original = readConfig(file);
  const config = stripHooks(original, provider);
  const relayPath = path.join(home, ".nyapix", "nyapix-agent-relay.cjs");
  // Commands are consumed by the harness shell. Reject special path characters.
  if (/["`$%\r\n]/.test(relayPath) || (runtimePath && /["`$%\r\n]/.test(runtimePath)))
    throw new Error("This home path needs manual hook setup.");
  if (enabled) {
    fs.mkdirSync(path.dirname(relayPath), { recursive: true });
    fs.copyFileSync(path.join(__dirname, "agent-relay.cjs"), relayPath);
    fs.chmodSync(relayPath, 0o700);
    const command = runtimePath ? `"${runtimePath.replace(/\\/g, "/")}" --nyapix-agent-relay ${provider}` : `node "${relayPath.replace(/\\/g, "/")}" ${provider}`;
    config.hooks ||= {};
    if (provider === "cursor") config.version = 1;
    for (const event of spec.events) {
      const handler = { command, timeout: 3 };
      const entry =
        provider === "cursor"
          ? handler
          : { hooks: [{ type: "command", ...handler }] };
      (config.hooks[event] ||= []).push(entry);
    }
  }
  if (JSON.stringify(config) === JSON.stringify(original))
    return integrationStatus(home);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file))
    fs.copyFileSync(file, `${file}.nyapix-backup-${Date.now()}`);
  const temporary = `${file}.nyapix-tmp`;
  fs.writeFileSync(temporary, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
  return integrationStatus(home);
}
module.exports = { setIntegration, integrationStatus, stripHooks, SPECS };
