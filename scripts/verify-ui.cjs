const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");

// Exercise the actual renderer in Electron without changing the user's settings.
app.whenReady().then(async () => {
  const errors = [];
  const saves = [];
  ipcMain.handle("settings:get", () => ({}));
  ipcMain.handle("music:get", () => ({ state: "disabled", playing: false }));
  ipcMain.handle("display:list", () => [{id:"test-screen",label:"Test screen",primary:true}]);
  ipcMain.handle("settings:set", (_, patch) => {
    saves.push(patch);
    return patch;
  });
  ipcMain.handle("calendar:upcoming", () => ({ events: [] }));
  ipcMain.handle("calendar:sync", () => ({ events: [] }));
  const agentSnapshot = {
    focus: { phase: "idle" },
    sessions: [],
    history: [],
    integrations: ["claude", "codex", "cursor"].map((provider) => ({
      provider,
      installed: false,
    })),
    ready: true,
  };
  ipcMain.handle("agents:get", () => agentSnapshot);
  ipcMain.handle("agents:clear", () => {
    agentSnapshot.history = [];
    return agentSnapshot;
  });
  ipcMain.handle("agents:connect", (_event, provider, enabled) => {
    agentSnapshot.integrations.find((p) => p.provider === provider).installed =
      enabled;
    return { ok: true, ...agentSnapshot };
  });
  const win = new BrowserWindow({
    width: 1040,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../src/main/preload-settings.js"),
      contextIsolation: true,
    },
  });
  win.webContents.on("console-message", (_event, level, message) => {
    if (level >= 3) errors.push(message);
  });
  const run = (fn) => win.webContents.executeJavaScript(`(${fn.toString()})()`);
  try {
    await win.loadFile(path.join(__dirname, "../src/settings/index.html"));
    await run(async () => {
      for (let i = 0; i < 50; i++) {
        if (window.__nyapixPreview?._lastGrid) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Preview did not render");
    });
    const initial = await run(() => {
      const cat = window.__nyapixPreview;
      return {
        pixels: cat._lastGrid.flatMap((row) => [...row]).filter(Boolean).length,
        overflow: document.documentElement.scrollWidth > innerWidth,
        hit: cat.hitTest(cat.x + cat.bodyW() * 0.45, cat.y + cat.bodyH() * 0.4),
        miss: cat.hitTest(cat.x, cat.y),
        presets: document.querySelectorAll("[data-preset]").length,
      };
    });
    assert(initial.pixels > 350, "Cat must have visible artwork");
    assert(
      initial.hit && !initial.miss,
      "Hit testing must follow the cat's silhouette",
    );
    assert(!initial.overflow, "Settings should fit the window");
    assert.equal(initial.presets, 8);
    const reactions = await run(async () => {
      const states = {};
      for (const button of document.querySelectorAll("[data-reaction]")) {
        if (button.hidden) continue;
        button.click();
        await new Promise((resolve) => setTimeout(resolve, 90));
        states[button.dataset.reaction] = window.__nyapixPreview.mode;
      }
      return states;
    });
    assert.deepEqual(reactions, {
      pet: "idle",
      type: "knead",
      think: "think",
      hop: "hop",
      stretch: "stretch",
      water: "water",
      paper: "paper",
      sleep: "sleep",
    });
    const controls = await run(async () => {
      document.querySelector('[data-tab="reminders"]').click();
      const rituals = [
        ...document.querySelectorAll('[data-panel="reminders"]'),
      ].every((p) => !p.hidden);
      document.getElementById("remTime").value = "12:30";
      document.getElementById("remText").value =
        '<img src=x onerror="alert(1)">';
      document.getElementById("addRem").click();
      const safe =
        !document.querySelector("#reminderList img") &&
        document
          .querySelector("#reminderList span")
          .textContent.includes("<img");
      document.querySelector("#reminderList button").click();
      const removed = !document.querySelector("#reminderList .chip");
      document.querySelector('[data-tab="look"]').click();
      document.querySelector('[data-preset="orange"]').click();
      const preset =
        document.getElementById("furColor").value === "#d37a32" &&
        document
          .querySelector('[data-preset="orange"]')
          .classList.contains("on");
      document.getElementById("scale").value = "3";
      document.getElementById("scale").dispatchEvent(new Event("input"));
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        rituals,
        safe,
        removed,
        preset,
        scale: document.getElementById("scaleVal").textContent,
        status: document.getElementById("saveStatus").textContent,
      };
    });
    assert(
      controls.rituals && controls.safe && controls.removed && controls.preset,
    );
    assert.equal(controls.scale, "3x");
    assert.equal(controls.status, "All changes saved");
    assert(
      saves.length >= 4,
      "Controls must persist through the desktop bridge",
    );
    // A deterministic preview for visual inspection.
    await run(() => {
      document.querySelector('[data-preset="cream"]').click();
      document.getElementById("scale").value = "5";
      document.getElementById("scale").dispatchEvent(new Event("input"));
      const cat = window.__nyapixPreview;
      cat.mode = "idle";
      cat.pet = 0;
      cat.blink = 0;
      cat.think = false;
      cat.idleT = 4;
      cat.keycaps = [];
      cat.hearts = [];
      cat.stretchBlend = 0;
      cat.paper = 0;
      cat.settings.paused = true;
      cat.draw();
      for (const button of document.querySelectorAll("[data-reaction]"))
        button.classList.remove("active");
    });
    await run(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const output = path.join(app.getPath("temp"), "nyapix-ui-overhaul.png");
    fs.writeFileSync(output, (await win.webContents.capturePage()).toPNG());
    await win.setSize(640, 820);
    assert.equal(
      await run(() => document.documentElement.scrollWidth > innerWidth),
      false,
      "Narrow window should fit",
    );
    await run(async () => {
      [...document.querySelectorAll("#pets button")]
        .find((b) => b.textContent === "Dog")
        .click();
      window.__nyapixPreview.draw();
      if (
        window.__nyapixPreview.loadedPet !== "dog" ||
        window.__nyapixPreview.sprite
      )
        throw new Error("Dog articulated art failed to load");
      [...document.querySelectorAll("#pets button")]
        .find((b) => b.textContent === "Cat")
        .click();
      if (window.__nyapixPreview.sprite)
        throw new Error("Cat did not switch back to articulated art");
    });
    // Check that coat choices and facial states produce different visible pixels.
    const art = await run(async () => {
      const { drawCatArt } = await import("../cat/art.js");
      const cat = window.__nyapixPreview;
      const c = document.createElement("canvas");
      c.width = c.height = 32;
      const ctx = c.getContext("2d");
      const outputs = [];
      for (const pattern of [
        "solid",
        "tabby",
        "tuxedo",
        "calico",
        "siamese",
        "spotted",
        "cow",
      ]) {
        cat.settings.pattern = pattern;
        cat.mode = "idle";
        drawCatArt(ctx, cat);
        outputs.push(c.toDataURL());
      }
      cat.settings.pattern = "solid";
      cat.mode = "sleep";
      drawCatArt(ctx, cat);
      const sleep = c.toDataURL();
      cat.mode = "knead";
      drawCatArt(ctx, cat);
      const typing = c.toDataURL();
      return {
        patterns: new Set(outputs).size,
        distinctPoses: outputs[0] !== sleep && sleep !== typing,
      };
    });
    assert.equal(art.patterns, 7, "All coats must have distinct markings");
    assert(art.distinctPoses, "Sleeping and typing must have distinct art");
    const dog = await run(async () => {
      const { drawDogArt } = await import("../cat/dog-art.js");
      [...document.querySelectorAll("#pets button")]
        .find((b) => b.textContent === "Dog")
        .click();
      document.querySelector('[data-preset="beagle"]').click();
      const pet = window.__nyapixPreview;
      const c = document.createElement("canvas");
      c.width = c.height = 32;
      const outputs = [];
      for (const mode of [
        "idle",
        "sleep",
        "knead",
        "think",
        "wave",
        "sniff",
        "water",
        "stretch",
        "reply",
      ]) {
        pet.mode = mode;
        pet.tailT = 1.3;
        pet.pet = 0;
        pet.blink = 0;
        pet.lookX = 0;
        drawDogArt(c.getContext("2d"), pet);
        outputs.push(c.toDataURL());
      }
      const patterns = [];
      for (const pattern of [
        "solid",
        "saddle",
        "blaze",
        "blacktan",
        "spotted",
        "patches",
      ]) {
        pet.mode = "idle";
        pet.settings.pattern = pattern;
        drawDogArt(c.getContext("2d"), pet);
        patterns.push(c.toDataURL());
      }
      document.querySelector('[data-preset="beagle"]').click();
      const fur = document.getElementById("furColor").value;
      [...document.querySelectorAll("#pets button")]
        .find((b) => b.textContent === "Cat")
        .click();
      [...document.querySelectorAll("#pets button")]
        .find((b) => b.textContent === "Dog")
        .click();
      const remembered =
        document.getElementById("furColor").value === fur &&
        document.getElementById("pattern").value === "saddle";
      document.querySelector('[data-reaction="wave"]').click();
      const wave = pet.mode === "wave";
      document.querySelector('[data-reaction="sniff"]').click();
      return {
        poses: new Set(outputs).size,
        patterns: new Set(patterns).size,
        remembered,
        wave,
        sniff: pet.mode === "sniff",
      };
    });
    assert(
      dog.poses >= 8 &&
        dog.patterns === 6 &&
        dog.remembered &&
        dog.wave &&
        dog.sniff,
    );
    await win.setSize(1040, 900);
    const agents = await run(async () => {
      document.querySelector('[data-tab="agents"]').click();
      document.querySelector('[data-connect="codex"]').click();
      await new Promise((resolve) => setTimeout(resolve, 120));
      const connected =
        document.querySelector('[data-connect="codex"]').textContent ===
        "Disconnect";
      const pet = window.__nyapixPreview;
      document.querySelector('[data-agent-demo="responding"]').click();
      const reply =
        pet.mode === "reply" && pet.bubble.includes("All checks passed");
      pet.setSettings({ agentShowOutput: false });
      const clearedExcerpt = !pet.bubble;
      pet.setSettings({ agentShowOutput: true });
      document.querySelector('[data-agent-demo="waiting"]').click();
      const wait = pet.mode === "waiting";
      pet.settings.agentShowOutput = false;
      pet.setAgentEvent({
        provider: "claude",
        phase: "done",
        text: "PRIVATE REPLY",
      });
      const privateOutput = !pet.bubble.includes("PRIVATE REPLY");
      pet.setAgentEvent({
        focus: { provider: "codex", phase: "thinking" },
        activeCount: 1,
        latest: { provider: "claude", phase: "done" },
      });
      const parallel = pet.mode === "think";
      pet.settings.agentShowOutput = true;
      return { connected, reply, wait, privateOutput, parallel, clearedExcerpt };
    });
    assert(Object.values(agents).every(Boolean));
    agentSnapshot.history = [
      {
        id: "fixture",
        provider: "codex",
        phase: "done",
        at: Date.now(),
        text: '<img src=x onerror="alert(1)"> Your build is ready.',
      },
    ];
    win.webContents.send("agents:changed", agentSnapshot);
    await run(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    assert(
      await run(
        () =>
          !document.querySelector("#agentHistory img") &&
          document.getElementById("agentHistory").textContent.includes("<img"),
      ),
    );
    fs.writeFileSync(
      path.join(app.getPath("temp"), "nyapix-dog-agents.png"),
      (await win.webContents.capturePage()).toPNG(),
    );
    await win.loadFile(path.join(__dirname, "../src/overlay/index.html"));
    await run(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    assert(
      await run(() => {
        const canvas = document.getElementById("stage");
        return canvas
          .getContext("2d")
          .getImageData(0, 0, canvas.width, canvas.height)
          .data.some((v, i) => i % 4 === 3 && v > 0);
      }),
      "Desktop overlay should render the new cat",
    );
    await win.loadFile(path.join(__dirname, "../src/preview/index.html"));
    await run(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const playground = await run(() => {
      const cat = window.__nyapix;
      document.getElementById("orange").click();
      const coat = cat.settings.furColor === "#d37a32";
      cat.update(0.016);
      cat.draw();
      const r = cat.catRect();
      cat.startDrag(r.x + r.w / 2, r.y + r.h / 2);
      const old = cat.x;
      cat.moveDrag(r.x + r.w / 2 + 25, r.y + r.h / 2);
      const dragged = cat.x !== old;
      cat.endDrag();
      document.getElementById("pomo").click();
      return {
        coat,
        dragged,
        timer: cat.pomodoro.running,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert(
      playground.coat &&
        playground.dragged &&
        playground.timer &&
        !playground.overflow,
    );
    assert.deepEqual(errors, [], "Renderer errors");
    console.log(
      JSON.stringify(
        {
          result: "PASS",
          initial,
          reactions,
          controls,
          art,
          dog,
          agents,
          playground,
          saves: saves.length,
          screenshot: output,
        },
        null,
        2,
      ),
    );
    app.exit(0);
  } catch (error) {
    console.error(error);
    console.error(errors);
    app.exit(1);
  }
});
