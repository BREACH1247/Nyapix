const names = { claude: "Claude Code", codex: "Codex", cursor: "Cursor" };
const phases = {
  thinking: "Thinking",
  responding: "Replying",
  waiting: "Needs your attention",
  done: "Finished",
  error: "Something went wrong",
  interrupted: "Interrupted",
  idle: "Standing by",
};

export function initAgents({ pet, onDemo }) {
  const api = window.nyapixSettings;
  const connections = document.getElementById("agentConnections");
  const history = document.getElementById("agentHistory");
  const setupStatus = document.getElementById("agentSetupStatus");
  let pending = false;
  function render(snapshot = {}) {
    const focus = snapshot.focus || { phase: "idle" };
    document.getElementById("agentSummary").textContent = snapshot.activeCount
      ? `${snapshot.activeCount} agent${snapshot.activeCount > 1 ? "s" : ""} at work`
      : "A little company while you code";
    document.getElementById("agentDetail").textContent = focus.provider
      ? `${names[focus.provider]} · ${focus.phase === "thinking" && focus.activity === "editing" ? "Editing" : focus.phase === "thinking" && focus.activity === "testing" ? "Testing" : phases[focus.phase] || "Standing by"}`
      : api?.agents
        ? "Connect a harness, then start a conversation."
        : "Browser preview · connect agents in the desktop app.";
    connections.replaceChildren();
    for (const [provider, name] of Object.entries(names)) {
      const config = snapshot.integrations?.find(
        (item) => item.provider === provider,
      );
      const last = snapshot.sessions?.find(
        (item) => item.provider === provider,
      );
      const row = document.createElement("div");
      row.className = "agent-connection";
      const monogram = document.createElement("span");
      monogram.className = `agent-monogram ${provider}`;
      monogram.textContent = name[0];
      const details = document.createElement("div");
      details.className = "connection-info";
      const title = document.createElement("strong");
      title.textContent = name;
      const status = document.createElement("small");
      status.textContent = config?.error
        ? config.error
        : last
          ? `${phases[last.phase]}${last.stale ? " · signal expired" : " · signal received"}`
          : config?.installed
            ? "Hooks installed · waiting for a signal"
            : "Not connected";
      details.append(title, status);
      if (config?.updateAvailable) {
        const update = document.createElement("button"); update.type = "button"; update.textContent = "Update reactions";
        update.disabled = pending;
        update.addEventListener("click", async () => {
          update.disabled = true;
          try { const result = await api.connectAgent(provider, true); setupStatus.textContent = result.ok ? "Reaction helper updated. Review /hooks in Codex if prompted." : result.error; if(result.ok)render(result); }
          catch { setupStatus.textContent = "Could not update reactions. Try again."; update.disabled = false; }
        });
        details.append(update);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.connect = provider;
      button.textContent = config?.installed ? "Disconnect" : "Connect";
      button.disabled = !api?.connectAgent || pending;
      button.addEventListener("click", async () => {
        pending = true;
        connections.querySelectorAll("button").forEach((b) => {
          b.disabled = true;
        });
        setupStatus.textContent = config?.installed
          ? "Removing Nyapix hooks…"
          : "Connecting…";
        try {
          const result = await api.connectAgent(provider, !config?.installed);
          pending = false;
          if (!result.ok) {
            setupStatus.textContent = result.error;
            render(snapshot);
            return;
          }
          setupStatus.textContent = config?.installed
            ? `${name} disconnected. Other hooks are preserved.`
            : provider === "codex"
              ? "Hooks added. Restart Codex and review them with /hooks, then send a prompt."
              : `Hooks added. Restart ${name}, then send a prompt to check the connection.`;
          render(result);
        } catch {
          pending = false;
          setupStatus.textContent =
            "Could not update the connection. Please try again.";
          render(snapshot);
        }
      });
      row.append(monogram, details, button);
      connections.append(row);
    }
    if (snapshot.error)
      setupStatus.textContent = `The local connection could not start: ${snapshot.error}`;
    history.replaceChildren();
    for (const event of snapshot.history || []) {
      const card = document.createElement("article");
      card.className = "agent-message";
      const meta = document.createElement("div");
      meta.className = "message-meta";
      const author = document.createElement("strong");
      author.textContent = `${names[event.provider]} · ${phases[event.phase]}`;
      const time = document.createElement("time");
      time.textContent = new Date(event.at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      meta.append(author, time);
      card.append(meta);
      const text = document.createElement("p");
      text.textContent =
        event.text ||
        (pet.settings.agentShowOutput === false
          ? "Reply excerpts are hidden."
          : event.phase === "waiting"
            ? "Return to your agent to continue."
            : "No reply text with this event.");
      card.append(text);
      history.append(card);
    }
    if (!history.children.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent =
        "A quiet desk for now. Your agents’ replies will appear here.";
      history.append(empty);
    }
    document.getElementById("clearAgents").disabled =
      !api?.clearAgents || !snapshot.history?.length;
  }
  render();
  api?.onAgents?.((snapshot) => {
    render(snapshot);
    pet.setAgentEvent(snapshot);
  });
  api
    ?.agents?.()
    .then((snapshot) => {
      render(snapshot);
      pet.setAgentEvent(snapshot);
    })
    .catch(() => {
      setupStatus.textContent =
        "Agent connection is unavailable. Restart the desktop app.";
    });
  document.getElementById("clearAgents").addEventListener("click", async () => {
    try {
      if (api?.clearAgents) render(await api.clearAgents());
    } catch {
      setupStatus.textContent = "Could not clear activity. Please try again.";
    }
  });
  for (const button of document.querySelectorAll("[data-agent-demo]")) {
    button.addEventListener("click", () => {
      onDemo();
      const phase = button.dataset.agentDemo;
      pet.setAgentEvent({
        provider: "codex",
        phase: ["editing","testing"].includes(phase) ? "thinking" : phase,
        activity: ["editing","testing"].includes(phase) ? phase : "thinking",
        text: ["done", "responding"].includes(phase)
          ? "The changes are ready. All checks passed."
          : "",
        session: "demo",
      });
      setupStatus.textContent =
        "Demo reaction only — this is not a live agent response.";
      for (const sibling of document.querySelectorAll("[data-agent-demo]"))
        sibling.setAttribute("aria-pressed", String(sibling === button));
    });
  }
}
