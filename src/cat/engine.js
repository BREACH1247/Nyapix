import { DEFAULTS, PET_DEFAULTS } from "../shared/defaults.js";
import { PixelAudio } from "./audio.js";
import { drawCatArt } from "./art.js";
import { drawDogArt } from "./dog-art.js";
import { prepareSprite, findEyes, findEyeHighlights, splitTail, splitPaws, applyEyes, applyLook, drawKeycap, drawPixelHeart, drawPixelKeyboard, drawPixelToiletPaper, drawPixelTongue, sampleNativeColors, recolorSprite, cloneImageData } from "./sprite.js";

const EMPTY = 0;
const BODY = 1;
const SHADOW = 2;
const CREAM = 3;
const INNER = 4;
const EYE = 5;
const PUPIL = 6;
const NOSE = 7;
const MARK = 8;
const OUTLINE = 9;
const ACCENT = 10;
const STEAM = 11;
const PAPER = 12;
const HEART = 13;
const CALICO = 14;

const GW = 32;
const GH = 32;

function hexToRgb(hex) {
  const n = hex.replace("#", "");
  const v = parseInt(n.length === 3 ? n.split("").map((c) => c + c).join("") : n, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function darken(rgb, t = 0.35) {
  return mix(rgb, [0, 0, 0], t);
}

function grid() {
  return Array.from({ length: GH }, () => new Uint8Array(GW));
}

function inb(x, y) {
  return x >= 0 && y >= 0 && x < GW && y < GH;
}

function setp(g, x, y, v) {
  x = x | 0;
  y = y | 0;
  if (inb(x, y) && (g[y][x] === EMPTY || v === OUTLINE || v === PUPIL || v === EYE || v === HEART || v === STEAM || v === PAPER)) {
    g[y][x] = v;
  } else if (inb(x, y) && v !== EMPTY && g[y][x] === EMPTY) {
    g[y][x] = v;
  } else if (inb(x, y) && (v === BODY || v === SHADOW || v === CREAM || v === MARK || v === INNER || v === CALICO || v === ACCENT || v === NOSE)) {
    if (g[y][x] === EMPTY) g[y][x] = v;
    else if (v === MARK || v === CALICO || v === CREAM || v === PUPIL || v === EYE || v === NOSE || v === INNER) g[y][x] = v;
  }
}

function stamp(g, x, y, v) {
  x = x | 0;
  y = y | 0;
  if (inb(x, y)) g[y][x] = v;
}

function fillEllipse(g, cx, cy, rx, ry, v, overwrite = false) {
  const put = overwrite ? stamp : setp;
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if ((dx * dx) / rx2 + (dy * dy) / ry2 <= 1.05) put(g, x, y, v);
    }
  }
}

function fillRect(g, x, y, w, h, v, overwrite = false) {
  const put = overwrite ? stamp : setp;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) put(g, xx, yy, v);
  }
}

function fillTri(g, x0, y0, x1, y1, x2, y2, v) {
  const minx = Math.min(x0, x1, x2);
  const maxx = Math.max(x0, x1, x2);
  const miny = Math.min(y0, y1, y2);
  const maxy = Math.max(y0, y1, y2);
  for (let y = miny; y <= maxy; y++) {
    for (let x = minx; x <= maxx; x++) {
      const d = (x0 - x1) * (y2 - y1) - (x2 - x1) * (y0 - y1);
      const a = ((x1 - x) * (y2 - y) - (x2 - x) * (y1 - y)) / d;
      const b = ((x2 - x) * (y0 - y) - (x0 - x) * (y2 - y)) / d;
      const c = 1 - a - b;
      if (a >= 0 && b >= 0 && c >= 0) setp(g, x, y, v);
    }
  }
}

function outline(g) {
  const n = grid();
  for (let y = 0; y < GH; y++) n[y].set(g[y]);
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      if (g[y][x] === EMPTY || g[y][x] === OUTLINE || g[y][x] === STEAM || g[y][x] === PAPER || g[y][x] === HEART) continue;
      const edge =
        !inb(x - 1, y) || g[y][x - 1] === EMPTY ||
        !inb(x + 1, y) || g[y][x + 1] === EMPTY ||
        !inb(x, y - 1) || g[y - 1][x] === EMPTY ||
        !inb(x, y + 1) || g[y + 1][x] === EMPTY;
      if (edge) n[y][x] = OUTLINE;
    }
  }
  return n;
}

function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function applyPattern(g, pattern) {
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const v = g[y][x];
      if (v !== BODY && v !== SHADOW) continue;
      if (pattern === "tabby") {
        if ((y + Math.floor(x / 3)) % 5 === 0 || (y === 10 && x % 3 !== 1)) g[y][x] = MARK;
      } else if (pattern === "tuxedo") {
        if (y >= 16 && y <= 28 && x >= 12 && x <= 19) g[y][x] = CREAM;
        if (y >= 12 && y <= 18 && x >= 13 && x <= 18) g[y][x] = CREAM;
      } else if (pattern === "calico") {
        const h = hash(x, y);
        if (h > 0.72) g[y][x] = CALICO;
        else if (h > 0.5 && x < 16) g[y][x] = CREAM;
      } else if (pattern === "siamese") {
        const point = y < 10 || y > 24 || x < 8 || x > 23 || (x - 16) ** 2 + (y - 12) ** 2 < 20;
        if (point) g[y][x] = MARK;
      } else if (pattern === "spotted") {
        if (hash(Math.floor(x / 2), Math.floor(y / 2)) > 0.78) g[y][x] = MARK;
      } else if (pattern === "cow") {
        if (hash(Math.floor(x / 3), Math.floor(y / 3)) > 0.55) g[y][x] = CREAM;
      }
    }
  }
}

function raster(pose) {
  const g = grid();
  const {
    blink = 0,
    pupilX = 0,
    pupilY = 0,
    knead = 0,
    think = false,
    sleep = false,
    hop = 0,
    stretch = false,
    hunt = 0,
    paper = 0,
    overheat = false,
    hearts = 0,
    pawLift = 0,
    water = false,
    waterT = 0,
  } = pose;

  const hopY = -Math.round(hop * 7);
  const drinkDip = water ? Math.max(0, Math.round(Math.sin(waterT * 12))) : 0;
  const bodyY = 24 + hopY;
  const headY = 12 + hopY + drinkDip - (stretch ? 1 : 0);
  const crouch = hunt > 0.55;
  const bodyRx = stretch ? 7 : crouch ? 11 : 8;
  const bodyRy = stretch ? 10 : crouch ? 5 : 6;

  fillEllipse(g, 25, 23 + hopY, 2.4, 7, BODY);
  fillEllipse(g, 26, 17 + hopY, 2, 2, BODY);
  fillEllipse(g, 16, bodyY, bodyRx, bodyRy, BODY);
  fillEllipse(g, 16, bodyY + 1, 5, 3.4, SHADOW);

  if (stretch) {
    fillEllipse(g, 9, 9 + hopY, 2, 7, BODY);
    fillEllipse(g, 23, 9 + hopY, 2, 7, BODY);
    fillEllipse(g, 9, 3 + hopY, 2.2, 2.2, BODY);
    fillEllipse(g, 23, 3 + hopY, 2.2, 2.2, BODY);
  }

  fillEllipse(g, 16, headY, 9.4, 8.2, BODY);
  fillTri(g, 7, 9 + hopY, 10, 1 + hopY, 14, 8 + hopY, BODY);
  fillTri(g, 18, 8 + hopY, 22, 1 + hopY, 25, 9 + hopY, BODY);
  fillTri(g, 9, 8 + hopY, 10, 3 + hopY, 13, 8 + hopY, INNER);
  fillTri(g, 19, 8 + hopY, 22, 3 + hopY, 23, 8 + hopY, INNER);
  fillEllipse(g, 16, headY + 3.5, 4.6, 3, CREAM);

  const k = Math.round(Math.sin(knead * Math.PI) * 3);
  const pawY = 29 + hopY - k + (stretch ? -9 : 0);
  const pawY2 = 29 + hopY + k - (stretch ? 9 : 0);
  const pawX1 = crouch ? 7 : knead ? 10 : 11;
  const pawX2 = crouch ? 17 : knead ? 21 : 20;
  fillEllipse(g, pawX1, pawY - pawLift, knead && k > 0 ? 3.6 : 3.2, knead && k > 0 ? 1.4 : 2.1, BODY);
  fillEllipse(g, pawX2, pawY2, knead && k < 0 ? 3.6 : 3.2, knead && k < 0 ? 1.4 : 2.1, BODY);
  fillEllipse(g, pawX1, pawY + 1 - pawLift, 2, 1, CREAM);
  fillEllipse(g, pawX2, pawY2 + 1, 2, 1, CREAM);
  if (water) {
    fillRect(g, 7, 27 + hopY, 14, 4, SHADOW, true);
    fillRect(g, 8, 28 + hopY, 12, 2, STEAM, true);
    fillRect(g, 9, 28 + hopY, 4, 1, ACCENT, true);
    const lick = Math.max(0, Math.round(Math.sin(waterT * 12) * 4));
    if (lick > 0) {
      fillRect(g, 15, headY + 5, 2, 2 + lick, INNER, true);
      stamp(g, 15, headY + 7 + lick, INNER);
      stamp(g, 16, headY + 7 + lick, INNER);
    }
  }
  if (knead) {
    fillRect(g, 8, 30 + hopY, 16, 2, PAPER, true);
    fillRect(g, 9, 29 + hopY, 2, 1, ACCENT, true);
    fillRect(g, 12, 29 + hopY, 2, 1, ACCENT, true);
    fillRect(g, 15, 29 + hopY, 2, 1, ACCENT, true);
    fillRect(g, 18, 29 + hopY, 2, 1, ACCENT, true);
    fillRect(g, 21, 29 + hopY, 2, 1, ACCENT, true);
  }

  if (paper > 0) {
    const len = Math.min(14, 5 + Math.floor(paper * 10));
    fillEllipse(g, 8, 24 + hopY, 3.2, 3.2, PAPER, true);
    fillEllipse(g, 8, 24 + hopY, 1.1, 1.1, SHADOW, true);
    fillRect(g, 11, 24 + hopY, len, 2, PAPER, true);
    stamp(g, 11 + len, 23 + hopY, PAPER);
    stamp(g, 12 + len, 24 + hopY, PAPER);
  }

  const eyeOpen = sleep ? 0 : 1 - blink;
  const eY = headY - 1;
  if (eyeOpen < 0.25) {
    fillRect(g, 9, eY + 1, 5, 1, OUTLINE, true);
    fillRect(g, 18, eY + 1, 5, 1, OUTLINE, true);
  } else {
    const eh = eyeOpen > 0.7 ? 3.4 : 2;
    fillEllipse(g, 11.5, eY, 3.4, eh, EYE, true);
    fillEllipse(g, 20.5, eY, 3.4, eh, EYE, true);
    const px = Math.round(pupilX);
    const py = Math.round(pupilY);
    if (!think) {
      stamp(g, 11 + px, eY + py, PUPIL);
      stamp(g, 12 + px, eY + py, PUPIL);
      stamp(g, 11 + px, eY + 1 + py, PUPIL);
      stamp(g, 12 + px, eY + 1 + py, PUPIL);
      stamp(g, 20 + px, eY + py, PUPIL);
      stamp(g, 21 + px, eY + py, PUPIL);
      stamp(g, 20 + px, eY + 1 + py, PUPIL);
      stamp(g, 21 + px, eY + 1 + py, PUPIL);
      stamp(g, 11 + px, eY + py, EYE);
      stamp(g, 20 + px, eY + py, EYE);
    } else {
      fillRect(g, 10, eY, 4, 1, PUPIL, true);
      fillRect(g, 19, eY, 4, 1, PUPIL, true);
      stamp(g, 12, eY + 1, PUPIL);
      stamp(g, 21, eY + 1, PUPIL);
    }
  }

  stamp(g, 16, headY + 3, NOSE);
  stamp(g, 15, headY + 3, NOSE);
  if (!sleep && !think) stamp(g, 16, headY + 5, OUTLINE);

  applyPattern(g, pose.pattern || "solid");

  if (overheat) {
    for (let i = 0; i < 5; i++) {
      stamp(g, 12 + i * 2, 3 + ((pose.steam + i) % 4), STEAM);
      stamp(g, 13 + i * 2, 2 + ((pose.steam + i + 1) % 3), STEAM);
    }
  }

  if (think) {
    stamp(g, 26, 8 + hopY, ACCENT);
    stamp(g, 27, 6 + hopY, ACCENT);
    stamp(g, 29, 4 + hopY, ACCENT);
    fillEllipse(g, 29, 2 + hopY, 2, 2, ACCENT);
  }

  if (sleep) {
    stamp(g, 26, 8 + hopY, ACCENT);
    stamp(g, 27, 7 + hopY, ACCENT);
    stamp(g, 28, 8 + hopY, ACCENT);
    stamp(g, 27, 5 + hopY, ACCENT);
  }

  if (hearts > 0) {
    const hx = 7 + Math.round(Math.sin(hearts * 5.2) * 3);
    const hy = 3 + hopY - Math.round((hearts % 1) * 5);
    stamp(g, hx + 1, hy, HEART);
    stamp(g, hx + 3, hy, HEART);
    stamp(g, hx, hy + 1, HEART);
    stamp(g, hx + 1, hy + 1, HEART);
    stamp(g, hx + 2, hy + 1, HEART);
    stamp(g, hx + 3, hy + 1, HEART);
    stamp(g, hx + 4, hy + 1, HEART);
    stamp(g, hx + 1, hy + 2, HEART);
    stamp(g, hx + 2, hy + 2, HEART);
    stamp(g, hx + 3, hy + 2, HEART);
    stamp(g, hx + 2, hy + 3, HEART);
  }

  return outline(g);
}

const DIGITS = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "001", "001"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  ":": ["000", "010", "000", "010", "000"],
};

export class NyapixCat {
  constructor(canvas, settings = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.settings = { ...DEFAULTS, ...settings };
    this.audio = new PixelAudio();
    this.buf = document.createElement("canvas");
    this.buf.width = GW;
    this.buf.height = GH;
    this.bctx = this.buf.getContext("2d");
    this.pixels = this.bctx.createImageData(GW, GH);

    this.x = 0;
    this.y = 0;
    this.homeX = null;
    this.homeY = null;
    this.autoPlaced = true;
    this.tilt = 0;
    this.bob = 0;
    this.walkT = 0;
    this.bowlA = 0;
    this.afterHop = null;
    this.vx = 0;
    this.vy = 0;
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    this.mouseSeen = false;
    this.display = { w: 800, h: 600, insetLeft: 0, insetTop: 0, insetRight: 0, insetBottom: 0 };

    this.mode = "idle";
    this.modeT = 0;
    this.blink = 0;
    this.blinkIn = 2 + Math.random() * 3;
    this.idleT = 0;
    this.keys = 0;
    this.keyWindow = [];
    this.scroll = 0;
    this.paper = 0;
    this.paperSpin = 0;
    this.hunt = 0;
    this.pet = 0;
    this.hearts = [];
    this.lastHeartAt = 0;
    this.drag = null;
    this.stretch = { x: 1, y: 1 };
    this.stretchBlend = 0;
    this.wobble = 0;
    this.shake = 0;
    this.overheat = 0;
    this.steam = 0;
    this.hop = 0;
    this.think = false;
    this.bubble = "";
    this.bubbleT = 0;
    this.pomodoro = { running: false, phase: "focus", left: 25 * 60, last: 0 };
    this.lastFrame = performance.now();
    this.peek = this.settings.peekMode;
    this.placed = false;
    this.sprite = null;
    this.spriteHit = null;
    this.highlights = [];
    this.eyes = [];
    this.tailParts = null;
    this.pawParts = null;
    this.pawLeftOriginal = null;
    this.pawRightOriginal = null;
    this.leftTap = 0;
    this.rightTap = 0;
    this.pawSide = 1;
    this.pawBeat = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.tailT = 0;
    this.tailAngle = 0;
    this.lookBuf = document.createElement("canvas");
    this.keycaps = [];
    this.tap = 0;
    this.previewFit = false;
    this.nativeColors = null;
    this.bodyOriginal = null;
    this.tailOriginal = null;
    this.heatBuf = null;
    this.loadedPet = null;
    this.loadSprite();
  }

  spriteUrl() {
    const dog = this.settings.petKind === "dog";
    return new URL(dog ? "./sprite-dog.png" : "./sprite.png", import.meta.url).href;
  }

  loadSprite() {
    const kind = this.settings.petKind === "dog" ? "dog" : "cat";
    this.loadedPet = kind;
    this.sprite = this.spriteHit = this.bodyOriginal = null;
    this.tailParts = this.pawParts = null;
    this.nativeColors = { ...PET_DEFAULTS[kind] };
    this.audio.purrStop();
    if (this.autoPlaced && this.display.w) this.placeDefault();
  }

  setSettings(next) {
    const relocate = (next.homeCorner && next.homeCorner !== this.settings.homeCorner) || (next.homeDisplay && next.homeDisplay !== this.settings.homeDisplay);
    if (next.renderMode && next.renderMode !== this.settings.renderMode) {
      this.render3D?.dispose();
      this.render3D = null;
      this.renderError = null;
    }
    const prevPet = this.settings.petKind === "dog" ? "dog" : "cat";
    this.settings = { ...this.settings, ...next };
    if ((next.agentShowOutput === false || next.agentEnabled === false) && this.agentBubble) {
      this.bubble = ""; this.bubbleT = 0; this.agentBubble = false;
    }
    if (this.settings.soundEnabled === false) this.audio.purrStop();
    this.peek = !!this.settings.peekMode;
    if (next.pomodoroEnabled && !this.pomodoro.running) this.startPomodoro();
    if (next.pomodoroEnabled === false) this.pomodoro.running = false;
    const pet = this.settings.petKind === "dog" ? "dog" : "cat";
    if (pet !== prevPet || pet !== this.loadedPet) this.loadSprite();
    else this.rebuildRecolor();
    if (relocate && !this.previewFit) this.placeDefault();
  }

  rebuildRecolor() {
    if (!this.bodyOriginal) return;
    this.bodyHit = recolorSprite(this.bodyOriginal, this.settings, this.nativeColors);
    if (this.tailParts?.tail && this.tailOriginal) {
      const tinted = recolorSprite(this.tailOriginal, this.settings, this.nativeColors);
      this.tailParts.tail.getContext("2d").putImageData(tinted, 0, 0);
    }
    if (this.pawParts?.left && this.pawLeftOriginal) {
      const tinted = recolorSprite(this.pawLeftOriginal, this.settings, this.nativeColors);
      this.pawParts.left.canvas.getContext("2d").putImageData(tinted, 0, 0);
    }
    if (this.pawParts?.right && this.pawRightOriginal) {
      const tinted = recolorSprite(this.pawRightOriginal, this.settings, this.nativeColors);
      this.pawParts.right.canvas.getContext("2d").putImageData(tinted, 0, 0);
    }
  }

  buildHeatMask() {
    if (!this.spriteHit) return;
    const { width: w, height: h, data } = this.spriteHit;
    if (!this.heatBuf) this.heatBuf = document.createElement("canvas");
    this.heatBuf.width = w;
    this.heatBuf.height = h;
    const img = this.heatBuf.getContext("2d").createImageData(w, h);
    const yMax = Math.floor(h * 0.5);
    for (let y = 0; y < yMax; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] < 24) continue;
        img.data[i] = 210;
        img.data[i + 1] = 64;
        img.data[i + 2] = 48;
        img.data[i + 3] = 255;
      }
    }
    this.heatBuf.getContext("2d").putImageData(img, 0, 0);
  }

  setDisplay(w, h, insets) {
    const prevBottom = this.display.insetBottom || 0;
    this.display.w = w;
    this.display.h = h;
    if (insets && typeof insets === "object") {
      this.display.insetLeft = Math.max(0, Number(insets.left) || 0);
      this.display.insetTop = Math.max(0, Number(insets.top) || 0);
      this.display.insetRight = Math.max(0, Number(insets.right) || 0);
      this.display.insetBottom = Math.max(0, Number(insets.bottom) || 0);
    }
    if (!this.placed) {
      this.placeDefault();
      this.placed = true;
    } else if (this.autoPlaced && this.display.insetBottom !== prevBottom) {
      this.placeDefault();
    } else {
      this.clampPos();
    }
  }

  floorPad() {
    return Math.max(12, (this.display.insetBottom || 0) + 12);
  }

  sidePad() {
    return Math.max(12, (this.display.insetRight || 0) + 16);
  }

  bodyW() {
    return (this.sprite ? this.sprite.width : GW) * this.pixelMul();
  }

  bodyH() {
    return (this.sprite ? this.sprite.height : GH) * this.pixelMul();
  }

  placeDefault() {
    const bw = this.bodyW();
    const bh = this.bodyH();
    this.x = Math.round(Math.max(8, this.display.w - bw - this.sidePad()));
    this.y = Math.round(Math.max(8, this.display.h - bh - this.floorPad()));
    if (this.settings.homeCorner?.endsWith("left")) this.x = 16 + (this.display.insetLeft || 0);
    if (this.settings.homeCorner?.startsWith("top")) this.y = 16 + (this.display.insetTop || 0);
    this.homeX = this.x;
    this.homeY = this.y;
    this.autoPlaced = true;
  }

  clampPos() {
    const pad = 8;
    const bw = this.bodyW();
    const bh = this.bodyH();
    const floor = this.floorPad();
    const side = this.sidePad();
    const maxX = Math.max(pad, this.display.w - bw - side);
    const maxY = this.peek && !this.drag
      ? Math.max(pad, this.display.h - floor - bh * 0.42)
      : Math.max(pad, this.display.h - bh - floor);
    this.x = Math.max(pad + (this.display.insetLeft || 0), Math.min(maxX, this.x));
    this.y = Math.max(pad + (this.display.insetTop || 0), Math.min(maxY, this.y));
  }

  rememberHome() {
    this.homeX = this.x;
    this.homeY = this.y;
    this.autoPlaced = false;
  }

  setMouse(x, y) {
    this.mouseSeen = true;
    const dx = x - this.mouse.x;
    const dy = y - this.mouse.y;
    this.mouse.sx = dx;
    this.mouse.sy = dy;
    this.mouse.x = x;
    this.mouse.y = y;
    const speed = Math.hypot(dx, dy);
    if (speed > 42 && !this.drag && this.mode === "idle") {
      this.hunt = Math.min(1, this.hunt + 0.25);
      if (this.hunt > 0.55) this.mode = "hunt";
    }
  }

  key(info = {}) {
    const now = performance.now();
    this.keyWindow.push(now);
    this.keys = 1;
    this.idleT = 0;
    if (this.mode === "idle" || this.mode === "knead") this.mode = "knead";
    const label = (info && info.label) || "•";
    const skipCap = ["⇧", "ctrl", "alt", "win", "⇪"].includes(label);
    this.pawSide = 1 - this.pawSide;
    if (this.pawSide === 0) this.leftTap = 1;
    else this.rightTap = 1;
    if (!skipCap && (!info.repeat || now - (this.lastCapAt || 0) > 80)) {
      this.spawnKeycap(label, this.pawSide === 0);
      this.lastCapAt = now;
    }
    this.tap = 0.4;
  }

  spawnKeycap(label, left = true) {
    const r = this.catRect();
    const part = left ? this.pawParts?.left : this.pawParts?.right;
    const sw = this.sprite?.width || GW;
    const sh = this.sprite?.height || GH;
    const tipX = part ? (part.pivot.x / sw) * r.w : r.w * (left ? 0.28 : 0.52);
    const tipY = part ? ((part.tipY ?? part.pivot.y) / sh) * r.h : r.h * 0.82;
    this.keycaps.push({
      x: r.x + tipX - r.w * .04,
      y: r.y + tipY - r.h * .10,
      vx: (left ? -1 : 1) * r.w * (.15 + Math.random() * .08),
      vy: -r.h * (.36 + Math.random() * .12),
      life: .85,
      label: String(label || "•").slice(0, 3),
    });
    if (this.keycaps.length > 8) this.keycaps.shift();
  }

  wheel(delta) {
    this.scroll = Math.max(this.scroll, Math.min(2, Math.abs(delta) / 80));
    this.paper = 1;
    this.paperSpin += Math.abs(delta) / 240;
    if (this.mode === "idle" || this.mode === "paper") this.mode = "paper";
    this.idleT = 0;
  }

  startDrag(x, y) {
    this.drag = { dx: x - this.x, dy: y - this.y, lastX: x, lastY: y };
    this.mode = "drag";
    this.audio.ensure();
  }

  moveDrag(x, y) {
    if (!this.drag) return;
    const nx = x - this.drag.dx;
    const ny = y - this.drag.dy;
    const vx = x - this.drag.lastX;
    this.x = nx;
    this.y = ny;
    this.stretch.x = Math.max(0.55, Math.min(1.7, 1 + Math.abs(y - this.drag.lastY) / 90 - Math.abs(vx) / 140));
    this.stretch.y = Math.max(0.55, Math.min(1.8, 1 + Math.abs(vx) / 90 - Math.abs(y - this.drag.lastY) / 140));
    this.shake = Math.min(8, this.shake + Math.abs(vx) / 18);
    this.drag.lastX = x;
    this.drag.lastY = y;
    this.idleT = 0;
  }

  endDrag() {
    this.drag = null;
    this.mode = "idle";
    this.rememberHome();
  }

  petHead(x, y) {
    const head = this.headRect();
    if (x >= head.x && x <= head.x + head.w && y >= head.y && y <= head.y + head.h) {
      const before = this.pet;
      this.pet = Math.min(1.5, this.pet + 0.08);
      this.idleT = 0;
      if (this.pet > 0.18 && this.settings.petKind !== "dog" && this.settings.soundEnabled !== false) this.audio.purrStart(this.pet);
      if (before < 0.2 && this.pet >= 0.2) {
        for (let i = 0; i < 3; i++) this.spawnHeart(head);
        this.lastHeartAt = performance.now();
        return;
      }
      const now = performance.now();
      const gap = this.pet > 1 ? 95 : 170;
      if (now - this.lastHeartAt > gap) {
        this.spawnHeart(head);
        if (this.pet > 0.85 && Math.random() < 0.55) this.spawnHeart(head);
        this.lastHeartAt = now;
      }
    }
  }

  spawnHeart(head) {
    const r = head || this.headRect();
    const phase = Math.random() * Math.PI * 2;
    this.hearts.push({
      x: r.x + r.w * (0.2 + Math.random() * 0.52),
      y: r.y - 10 - Math.random() * 22,
      vx: 0,
      vy: -58 - Math.random() * 36,
      sway: 16 + Math.random() * 28,
      phase,
      life: 1,
      size: 0.75 + Math.random() * 1.15,
      tint: Math.random(),
    });
    if (this.hearts.length > 22) this.hearts.shift();
  }

  say(text, seconds = 4) {
    this.agentBubble = false;
    const name = (this.settings.userName || "").trim();
    this.bubble = name ? text.replaceAll("{name}", name) : text.replaceAll("{name}", "friend").replace(" ,", ",").replace("friend?", "you?");
    this.bubbleT = seconds;
    if (this.settings.soundEnabled !== false) {
      if (this.settings.petKind === "dog") this.audio.bark();
      else this.audio.meow(this.mode === "hop" ? 1.15 : 1);
    }
  }

  setAgent(status) {
    if (typeof status === "object" && status) return this.setAgentEvent(status);
    if (status === "think") {
      this.think = true;
      const busy =
        this.drag ||
        this.mode === "hunt" ||
        this.mode === "home" ||
        this.mode === "water" ||
        this.mode === "stretch" ||
        this.mode === "hop";
      if (!busy) {
        this.mode = "think";
        this.modeT = 0;
      }
    } else if (status === "done") {
      if (this._agentDoneAt && performance.now() - this._agentDoneAt < 6000) return;
      this._agentDoneAt = performance.now();
      this.think = false;
      this.mode = "hop";
      this.modeT = 0;
      this.hop = 0;
      this.say(this.settings.userName ? "{name}, done!" : "done!");
    } else {
      this.think = false;
      if (this.mode === "think") this.mode = "idle";
    }
  }

  setAgentEvent(packet) {
    const event = packet.focus || packet;
    const labels = { claude: "Claude Code", codex: "Codex", cursor: "Cursor" };
    const source = labels[event.provider] || "Agent";
    const latest = packet.focus ? packet.latest : event;
    this.agentInfo = { ...event, source, activeCount: packet.activeCount || 0 };
    if (this.settings.paused) return;
    this.think = event.phase === "thinking";
    const busy = this.drag || ["water", "stretch"].includes(this.mode);
    if (!busy) {
      const next = event.phase === "done" ? (latest?.phase === "done" ? "hop" : "idle") : { thinking: event.activity === "editing" ? "edit" : event.activity === "testing" ? "test" : "think", responding: "reply", waiting: "waiting", error: "waiting" }[event.phase] || "idle";
      if (this.mode !== next) { this.mode = next; this.modeT = 0; this.hop = 0; }
      if (next === "hop") this.afterHop = "idle";
    }
    if (latest && ["done", "responding", "waiting", "error", "interrupted"].includes(latest.phase)) {
      const author = labels[latest.provider] || source;
      const output = this.settings.agentShowOutput !== false && latest.text;
      const messages = { done: "finished the task", responding: "has a reply", waiting: "needs your attention", error: "ran into a problem", interrupted: "was interrupted" };
      this.bubble = output ? `${author}: ${latest.text.slice(0, 220)}${latest.text.length > 220 ? "…" : ""}` : `${author} ${messages[latest.phase]}.`;
      this.bubbleT = output ? 10 : 5;
      this.agentBubble = true;
      if (latest.phase === "done" && this.settings.agentSound && this.settings.soundEnabled !== false) {
        if (this.settings.petKind === "dog") this.audio.bark(); else this.audio.meow();
      }
    } else if (event.phase === "idle") { this.bubble = ""; this.bubbleT = 0; }
  }

  remindStretch() {
    if (this.quiet) return;
    this.mode = "stretch";
    this.modeT = 0;
    this.say(this.settings.userName ? "stretch with me, {name}!" : "time to stretch!");
  }

  remindWater() {
    if (this.quiet) return;
    this.mode = "water";
    this.modeT = 0;
    this.say(this.settings.userName ? "drink some water, {name}" : "drink some water!");
  }

  remindMessage(message) {
    if (this.quiet) return;
    this.mode = "hop";
    this.modeT = 0;
    this.say(message);
  }

  startRoutine(name) {
    if (!["groom", "chase", "toy", "sleep"].includes(name) || this.settings.paused || this.quiet || this.drag) return false;
    if (["thinking","responding","waiting"].includes(this.agentInfo?.phase)) return false;
    this.mode = name; this.modeT = 0; this.routineCooldown = 35 + Math.random() * 35;
    if (name === "sleep") this.idleT = 91;
    return true;
  }

  startPomodoro() {
    const focus = (this.settings.pomodoroFocus || 25) * 60;
    this.pomodoro = { running: true, phase: "focus", left: focus, last: performance.now() };
  }

  togglePomodoro() {
    if (this.pomodoro.running) this.pomodoro.running = false;
    else this.startPomodoro();
  }

  pixelMul() {
    if (!this.sprite) return this.previewFit
      ? Math.max(1, Math.min(this.settings.scale || 5, Math.floor(Math.min(this.display.w, this.display.h) / 48)))
      : this.settings.scale || 5;
    const native = Math.max(this.sprite.width, this.sprite.height);
    const shrink = native > 48 ? 48 / native : 1;
    if (this.previewFit && this.display.w) {
      return Math.max(2, Math.round(Math.min((this.display.w - 12) / this.sprite.width, (this.display.h - 12) / this.sprite.height)));
    }
    return Math.max(1, Math.round((this.settings.scale || 5) * shrink));
  }

  spriteSize() {
    return Math.max(this.bodyW(), this.bodyH());
  }

  catRect() {
    const sw = this.bodyW();
    const sh = this.bodyH();
    const tap = 1 - this.tap * 0.04;
    const stretchW = 1 + this.stretchBlend * (0.22 + Math.sin(this.modeT * 3) * 0.05);
    const stretchH = 1 + this.stretchBlend * (0.38 + Math.sin(this.modeT * 3) * 0.04);
    const bounce = this.mode === "hop" ? Math.max(0, 1 - this.modeT / 0.1) * 0.12 : 0;
    const sx = sw * this.stretch.x * stretchW * (1 + bounce + this.hop * 0.025);
    const sy = sh * this.stretch.y * tap * stretchH * (1 - bounce - this.hop * 0.045);
    const hopY = this.hop * sh * 0.22;
    const drink = this.mode === "water" ? Math.max(0, Math.sin(this.modeT * 13)) * sh * 0.04 : 0;
    return {
      x: Math.round(this.x),
      y: Math.round(this.y - hopY - (this.bob || 0) + drink + (sh - sy)),
      w: Math.round(sx),
      h: Math.round(sy),
    };
  }

  headRect() {
    const r = this.catRect();
    return { x: r.x + r.w * 0.18, y: r.y + r.h * 0.08, w: r.w * 0.64, h: r.h * 0.45 };
  }

  hitTest(px, py) {
    const r = this.catRect();
    if (px < r.x || py < r.y || px > r.x + r.w || py > r.y + r.h) return false;
    if (this.settings.renderMode === "3d" && this.render3D && !this.render3D.lost) return this.render3D.hitTest((px - r.x) / r.w, (py - r.y) / r.h);
    if (this.spriteHit) {
      const u = (((px - r.x) / r.w) * this.spriteHit.width) | 0;
      const v = (((py - r.y) / r.h) * this.spriteHit.height) | 0;
      if (u < 0 || v < 0 || u >= this.spriteHit.width || v >= this.spriteHit.height) return false;
      return this.spriteHit.data[(v * this.spriteHit.width + u) * 4 + 3] > 20;
    }
    const u = ((px - r.x) / r.w) * GW;
    const v = ((py - r.y) / r.h) * GH;
    const g = this._lastGrid;
    if (!g) return true;
    const x = u | 0;
    const y = v | 0;
    return inb(x, y) && g[y][x] !== EMPTY;
  }

  palette() {
    const fur = hexToRgb(this.settings.furColor);
    const belly = hexToRgb(this.settings.bellyColor);
    const inner = hexToRgb(this.settings.innerEarColor);
    const mark = hexToRgb(this.settings.markColor);
    const eye = hexToRgb(this.settings.eyeColor);
    const pupil = hexToRgb(this.settings.pupilColor);
    const nose = hexToRgb(this.settings.noseColor);
    const heat = this.overheat > 0 ? Math.min(1, this.overheat) : 0;
    const body = mix(fur, [210, 64, 48], heat * 0.72);
    return {
      [BODY]: body,
      [SHADOW]: darken(body, 0.28),
      [CREAM]: belly,
      [INNER]: inner,
      [EYE]: eye,
      [PUPIL]: pupil,
      [NOSE]: nose,
      [MARK]: mark,
      [OUTLINE]: mix(darken(body, 0.55), [80, 16, 12], heat),
      [ACCENT]: [250, 250, 245],
      [STEAM]: [230, 230, 230],
      [PAPER]: [248, 244, 228],
      [HEART]: [232, 92, 118],
      [CALICO]: [211, 122, 50],
    };
  }

  update(dt) {
    if (this.settings.paused) return;
    this.modeT += dt;
    this.idleT += dt;
    this.routineCooldown = (this.routineCooldown ?? 30) - dt;
    if (["groom","chase","toy"].includes(this.mode) && this.modeT > 5) { this.mode = "idle"; this.modeT = 0; }
    if (this.settings.routinesEnabled && !this.quiet && !this.previewFit && !this.drag && this.mode === "idle" && !this.think && !["thinking","responding","waiting"].includes(this.agentInfo?.phase) && !this.music?.playing && this.idleT > 18 && this.idleT < 85 && this.routineCooldown <= 0) {
      this.startRoutine(["groom","chase","toy"][Math.floor(Math.random() * 3)]);
    }
    if (this.settings.spotifyEnabled && this.music?.playing && this.mode === "idle") this.idleT = 0;
    this.steam += dt * 6;
    if (["wave", "sniff"].includes(this.mode) && this.modeT > 3) this.mode = this.think ? "think" : "idle";
    this.stretchBlend += ((this.mode === "stretch" ? 1 : 0) - this.stretchBlend) * (1 - Math.exp(-dt * 10));
    this.shake *= Math.pow(0.12, dt);
    this.wobble = Math.sin(performance.now() / 50) * this.shake * 0.08;
    this.stretch.x += (1 - this.stretch.x) * Math.min(1, dt * 8);
    this.stretch.y += (1 - this.stretch.y) * Math.min(1, dt * 8);
    this.paper = Math.max(0, this.paper - dt * 0.45);
    this.scroll = Math.max(0, this.scroll - dt);
    if (this.paper > 0) this.paperSpin += dt * (1.1 + this.scroll * 2.4);
    this.hunt = Math.max(0, this.hunt - dt * 0.22);
    this.pet = Math.max(0, this.pet - dt * 0.35);
    this.keys = Math.max(0, this.keys - dt * 1.15);
    this.overheat = Math.max(0, this.overheat - dt * 0.4);
    this.tap = Math.max(0, this.tap - dt * 8);
    this.leftTap = Math.max(0, this.leftTap - dt * 9);
    this.rightTap = Math.max(0, this.rightTap - dt * 9);
    if (["knead","edit"].includes(this.mode)) this.pawBeat += dt * (10 + Math.min(10, this.keyWindow.length));
    else this.pawBeat += dt * 2;
    for (const cap of this.keycaps) {
      cap.x += cap.vx * dt;
      cap.y += cap.vy * dt;
      cap.vy += 18 * dt;
      cap.life -= dt * 0.85;
    }
    this.keycaps = this.keycaps.filter((c) => c.life > 0);
    for (const h of this.hearts) {
      h.phase += dt * 3.2;
      h.vx = Math.sin(h.phase) * (h.sway || 22);
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.vy += 14 * dt;
      h.vy *= 0.992;
      h.size = Math.min(2.1, (h.size || 1) + dt * 0.28);
      h.life -= dt * 0.48;
    }
    this.hearts = this.hearts.filter((h) => h.life > 0);
    if (this.bubbleT > 0) this.bubbleT -= dt;
    else this.bubble = "";
    if (this.pet < 0.12) this.audio.purrStop();

    const now = performance.now();
    this.keyWindow = this.keyWindow.filter((t) => now - t < 1000);
    if (this.keyWindow.length >= 14) this.overheat = 1.2;

    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkElapsed = 0;
      this.blinkIn = 2.4 + Math.random() * 3.4;
    }
    if (this.blinkElapsed != null) {
      this.blinkElapsed += dt;
      const phase = this.blinkElapsed;
      // Quick close, a tiny hold, then a softer opening.
      const openness = phase < .065 ? phase / .065 : phase < .095 ? 1 : 1 - (phase - .095) / .15;
      const amount = Math.max(0, Math.min(1, openness));
      this.blink = amount * amount * (3 - 2 * amount);
      if (phase >= .245) this.blinkElapsed = null;
    } else this.blink = 0;

    const rLook = this.catRect();
    const faceX = rLook.x + rLook.w * 0.42;
    const faceY = rLook.y + rLook.h * 0.28;
    const range = Math.max(90, rLook.w * 0.95);
    let tx = 0;
    let ty = 0;
    if (this.mouseSeen) {
      tx = Math.max(-1, Math.min(1, (this.mouse.x - faceX) / range));
      ty = Math.max(-1, Math.min(1, (this.mouse.y - faceY) / (range * 0.85)));
    }
    if (this.mode === "sleep") {
      tx = 0;
      ty = 0.45;
    } else if (this.mode === "think" || this.think) {
      tx = -0.15;
      ty = -0.75;
    } else if (this.mode === "knead") {
      tx = this.pawSide === 0 ? -0.22 : 0.22;
      ty = 0.82;
    } else if (this.mode === "water") {
      tx = -0.05;
      ty = 0.95;
    } else if (this.mode === "stretch") {
      tx = 0;
      ty = -0.55;
    } else if (this.mode === "paper") {
      tx = -0.2;
      ty = 0.7;
    } else if (["hunt","home","toy","chase"].includes(this.mode)) {
      tx = Math.max(-1, Math.min(1, ((this.mode === "hunt" ? this.mouse.x : this.homeX) - faceX) / range));
      ty = 0.15;
    }
    const follow = Math.min(1, dt * 16);
    this.lookX += (tx - this.lookX) * follow;
    this.lookY += (ty - this.lookY) * follow;
    this.pupilX = this.lookX * 2;
    this.pupilY = this.lookY * 1.6;

    this.tailT += dt;
    let wagAmp = 0.28;
    let wagSpd = 4.4;
    if (this.pet > 0.15) {
      wagAmp = 0.48;
      wagSpd = 9.5;
    } else if (this.mode === "hunt" || this.mode === "home") {
      wagAmp = 0.4;
      wagSpd = 8.5;
    } else if (this.mode === "knead" || this.mode === "edit") {
      wagAmp = 0.34;
      wagSpd = 6.5;
    } else if (this.mode === "water") {
      wagAmp = 0.22;
      wagSpd = 3.2;
    } else if (this.mode === "stretch") {
      wagAmp = 0.18;
      wagSpd = 2.4;
    } else if (this.mode === "sleep") {
      wagAmp = 0.05;
      wagSpd = 1.6;
    }
    this.tailAngle = Math.sin(this.tailT * wagSpd) * wagAmp;
    this.settlePose(dt);

    const busy = this.drag || this.mode === "hunt" || this.mode === "home" || this.mode === "stretch" || this.mode === "water" || this.mode === "hop";
    if (this.peek && !busy) {
      const targetY = this.display.h - this.floorPad() - this.bodyH() * 0.45;
      this.y += (targetY - this.y) * Math.min(1, dt * 3);
    } else if (!this.peek && !busy && this.homeX != null) {
      this.y += (this.homeY - this.y) * Math.min(1, dt * 2.2);
    }

    if (this.mode === "hunt" && this.hunt > 0.2) {
      const tx = this.mouse.x - this.bodyW() * 0.45;
      const ty = this.mouse.y - this.bodyH() * 0.25;
      this.x += (tx - this.x) * Math.min(1, dt * 2.6);
      this.y += (ty - this.y) * Math.min(1, dt * 2.6);
      if (Math.hypot(tx - this.x, ty - this.y) < 22) {
        this.mode = "hop";
        this.modeT = 0;
        this.afterHop = "home";
        if (this.settings.soundEnabled !== false) this.audio.pop();
      }
    } else if (this.mode === "hunt") {
      this.mode = "home";
      this.modeT = 0;
    }

    if (this.mode === "home" && this.homeX != null) {
      this.x += (this.homeX - this.x) * Math.min(1, dt * 2.8);
      this.y += (this.homeY - this.y) * Math.min(1, dt * 2.8);
      if (Math.hypot(this.homeX - this.x, this.homeY - this.y) < 5) {
        this.x = this.homeX;
        this.y = this.homeY;
        this.mode = this.think ? "think" : "idle";
      }
    }

    if (this.mode === "hop") {
      this.hop = Math.sin(Math.max(0, Math.min(1, (this.modeT - 0.1) / 0.45)) * Math.PI);
      if (this.modeT > 0.6) {
        this.hop = 0;
        this.mode = this.afterHop || (this.think ? "think" : "idle");
        this.afterHop = null;
      }
    } else {
      this.hop *= Math.pow(0.01, dt);
    }

    if (this.mode === "water") this.bowlA = Math.min(1, this.bowlA + dt * 4);
    else this.bowlA = Math.max(0, this.bowlA - dt * 2.5);

    if (this.mode === "stretch" && this.modeT > 5) this.mode = "idle";
    if (this.mode === "water" && this.modeT > 4) this.mode = "idle";
    if (this.mode === "knead" && this.keys <= 0) this.mode = this.think ? "think" : "idle";
    if (this.mode === "paper" && this.paper <= 0) this.mode = this.think ? "think" : "idle";
    if (this.think && (this.mode === "idle" || this.mode === "sleep")) this.mode = "think";
    if (this.mode === "idle" && this.agentInfo) {
      const waiting = { responding: "reply", waiting: "waiting", error: "waiting" }[this.agentInfo.phase];
      if (waiting) this.mode = waiting;
    }
    if (this.mode === "think" && !this.think) this.mode = "idle";
    if (["think","edit","test"].includes(this.mode) && this.think) this.mode = this.agentInfo?.activity === "editing" ? "edit" : this.agentInfo?.activity === "testing" ? "test" : "think";
    if (["edit","test"].includes(this.mode) && !this.think) this.mode = "idle";
    if (this.idleT > 90 && this.mode === "idle") this.mode = "sleep";
    if (this.mode === "sleep" && this.idleT < 2) this.mode = "idle";

    if (this.pomodoro.running) {
      this.pomodoro.left -= dt;
      if (this.pomodoro.left <= 0) {
        if (this.pomodoro.phase === "focus") {
          this.pomodoro.phase = "break";
          this.pomodoro.left = (this.settings.pomodoroBreak || 5) * 60;
          this.remindStretch();
          this.say(this.settings.userName ? "break time, {name}!" : "break time!");
        } else {
          this.pomodoro.phase = "focus";
          this.pomodoro.left = (this.settings.pomodoroFocus || 25) * 60;
          this.mode = "hop";
          this.modeT = 0;
          this.say(this.settings.userName ? "focus, {name}!" : "back to focus!");
        }
      }
    }

    this.clampPos();
  }

  settlePose(dt) {
    let tilt = 0;
    let bob = 0;
    if (this.mode === "idle") {
      bob = Math.sin(this.idleT * 2.4) * 2.4;
    } else if (this.mode === "sleep") {
      bob = Math.sin(this.idleT * 1.15) * 1.4;
      tilt = 0.07;
    } else if (this.mode === "think") {
      tilt = Math.sin(this.modeT * 1.5) * 0.12;
      bob = Math.sin(this.modeT * 2.1) * 2.2;
    } else if (this.mode === "stretch") {
      tilt = Math.sin(this.modeT * 3) * 0.09;
    } else if (this.mode === "water") {
      const lap = this.modeT > 0.35 && this.modeT < 3.35;
      tilt = lap ? -0.24 - Math.sin(this.modeT * 12) * 0.06 : -0.1;
      bob = lap ? Math.max(0, Math.sin(this.modeT * 12)) * 3.2 : 1.2;
    } else if (this.mode === "hunt" || this.mode === "home") {
      this.walkT += dt * 11;
      bob = Math.abs(Math.sin(this.walkT)) * 7;
      tilt = Math.sin(this.walkT) * 0.1;
    } else if (this.mode === "paper") {
      tilt = -0.06;
      bob = Math.sin(this.modeT * 9) * 3.5;
    } else if (this.mode === "knead") {
      bob = Math.sin(this.pawBeat) * 2.2;
      tilt = Math.sin(this.pawBeat) * 0.05;
    } else if (this.mode === "drag") {
      tilt = this.wobble;
    }
    const k = Math.min(1, dt * 10);
    this.tilt += (tilt - this.tilt) * k;
    this.bob += (bob - this.bob) * k;
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    const r = this.catRect();
    this.vibing = !!(this.settings.spotifyEnabled && this.music?.playing && !this.settings.paused && !this.quiet && this.mode === "idle" && !this.drag);
    if (this.vibing) r.y -= (1 + Math.sin(this.tailT * (this.settings.musicStyle === "dance" ? 8 : 5))) * r.h * (this.settings.musicStyle === "dance" ? .035 : this.settings.musicStyle === "bob" ? .025 : .008);

    const smooth = this.settings.renderMode === "3d";
    if (smooth && !this.render3D && !this.renderLoading && !this.renderError) {
      this.renderLoading = true;
      import("./pet-3d.js").then(({ Pet3D }) => {
        if (this.settings.renderMode === "3d") this.render3D = new Pet3D();
      }).catch((error) => { this.renderError = error.message; })
        .finally(() => { this.renderLoading = false; });
    }
    let rendered = false;
    if (smooth && this.render3D && !this.render3D.lost) {
      try {
        const model = this.render3D.render(this);
        ctx.imageSmoothingEnabled = true;
        ctx.save();
        ctx.fillStyle = "rgba(53,44,39,.12)";
        ctx.filter = "blur(3px)";
        ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, r.y + r.h * .92, r.w * .23, r.h * .035, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.drawImage(model, r.x, r.y, r.w, r.h);
        rendered = true;
      } catch (error) {
        this.renderError = error.message;
        this.render3D.dispose(); this.render3D = null;
      }
    }
    this.canvas.style.imageRendering = rendered ? "auto" : "pixelated";
    if (rendered) { /* Shared reminders and reactions are drawn below. */ }
    else if (this.sprite) this.drawSprite(ctx, r);
    else this.drawRaster(ctx, r);

    this.drawEffects(ctx, r);
    this.musicIndicator = this.drawMusicIndicator(ctx, r, rendered);
    const unit = Math.max(1, this.pixelMul() * .4);
    for (const cap of this.keycaps) drawKeycap(ctx, cap, unit);

    if (this.settings.pomodoroEnabled && this.pomodoro.running) {
      this.drawTimer(ctx, r);
    }
  }

  drawMusicIndicator(ctx, r, smooth = false) {
    if (!this.settings.spotifyEnabled || !this.music?.playing || this.settings.paused) return null;
    const unit = Math.max(1, Math.round(r.w / 80));
    const w = unit * 15, h = unit * 13;
    const bob = Math.sin(this.tailT * 3) * unit;
    const x = Math.round(Math.max(2, Math.min(this.display.w - w - 2, r.x + r.w * .82)));
    const y = Math.round(Math.max(2, Math.min(this.display.h - h - 2, r.y + r.h * .12 + bob)));
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = .85 + Math.sin(this.tailT * 3) * .12;
    ctx.fillStyle = "#a9d5b2";
    ctx.strokeStyle = "#25392d";
    ctx.lineWidth = Math.max(1, unit * .65);
    if (smooth) {
      ctx.beginPath();
      ctx.ellipse(unit * 3, unit * 9, unit * 2, unit * 1.4, -.3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke(); ctx.beginPath();
      ctx.ellipse(unit * 11, unit * 7, unit * 2, unit * 1.4, -.3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(unit * 4.5, unit * 9); ctx.lineTo(unit * 4.5, unit * 2);
      ctx.lineTo(unit * 12.5, 0); ctx.lineTo(unit * 12.5, unit * 7);
      ctx.strokeStyle = "#a9d5b2"; ctx.lineWidth = unit * 1.4; ctx.lineJoin = "round"; ctx.stroke();
    } else {
      const rows = ["000011111", "000011111", "000010001", "000010001", "000010001", "000010111", "001110111", "001110000"];
      // Dark one-pixel edging keeps the notes legible on light desktops.
      for (const outline of [true, false]) {
        ctx.fillStyle = outline ? "#25392d" : "#a9d5b2";
        rows.forEach((row, yy) => [...row].forEach((on, xx) => {
          if (on === "1") ctx.fillRect((xx + 1) * unit - (outline ? 1 : 0), (yy + 1) * unit - (outline ? 1 : 0), unit + (outline ? 2 : 0), unit + (outline ? 2 : 0));
        }));
      }
    }
    ctx.restore();
    return { x, y, w, h };
  }

  pawPose() {
    let leftPress = this.leftTap;
    let rightPress = this.rightTap;
    if (this.mode === "knead" && this.leftTap < 0.18 && this.rightTap < 0.18) {
      const wave = Math.sin(this.pawBeat);
      leftPress = Math.max(0, wave) ** 0.4;
      rightPress = Math.max(0, -wave) ** 0.4;
    } else if (this.mode === "water") {
      leftPress = 0.28;
      rightPress = 0.22;
    } else if (this.mode === "paper") {
      leftPress = 0.2;
      rightPress = 0.15 + Math.max(0, Math.sin(this.modeT * 9)) * 0.7;
    } else if (this.mode === "stretch") {
      leftPress = 0;
      rightPress = 0;
    }
    return {
      leftPress,
      rightPress,
      leftLift: Math.max(0, rightPress * 1.05 - leftPress * 0.2),
      rightLift: Math.max(0, leftPress * 1.05 - rightPress * 0.2),
    };
  }

  drawSprite(ctx, r) {
    const src = this.bodyHit || this.spriteHit;
    const blinked = this.mode === "sleep" ? 1 : this.blink;
    const sleeping = this.mode === "sleep";
    const looked = this.eyes.length
      ? applyEyes(src, this.eyes, this.lookX, this.lookY, blinked, sleeping, this.settings)
      : applyLook(src, this.highlights, this.lookX * 2, this.lookY * 1.6, blinked, sleeping);
    const lctx = this.lookBuf.getContext("2d");
    lctx.putImageData(looked, 0, 0);
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    const ang = this.wobble + this.tilt;
    if (Math.abs(ang) > 0.001) {
      const pivot = Math.round(r.h * 0.2);
      ctx.translate(0, pivot);
      ctx.rotate(ang);
      ctx.translate(0, -pivot);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    const shade = Math.max(3, Math.round(this.pixelMul() * 0.65));
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(Math.round(-r.w * 0.28), Math.round(r.h / 2) + 2, Math.round(r.w * 0.56), shade);
    ctx.drawImage(this.lookBuf, -r.w / 2, -r.h / 2, r.w, r.h);
    if (this.overheat > 0 && this.heatBuf) {
      ctx.save();
      ctx.shadowOffsetY = 0;
      ctx.globalAlpha = Math.min(0.38, this.overheat * 0.32);
      ctx.drawImage(this.heatBuf, -r.w / 2, -r.h / 2, r.w, r.h);
      ctx.restore();
    }
    if (this.tailParts?.tail) {
      const sw = this.sprite.width;
      const sh = this.sprite.height;
      const px = (this.tailParts.pivot.x / sw) * r.w - r.w / 2;
      const py = (this.tailParts.pivot.y / sh) * r.h - r.h / 2;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(this.tailAngle);
      ctx.shadowOffsetY = 0;
      ctx.drawImage(this.tailParts.tail, -r.w / 2 - px, -r.h / 2 - py, r.w, r.h);
      ctx.restore();
    }
    this.drawKeyboard(ctx, r);
    const pose = this.pawPose();
    const leftFirst = pose.leftLift <= pose.rightLift;
    if (leftFirst) {
      this.drawPaw(ctx, r, this.pawParts?.left, pose.leftPress, pose.leftLift, "left");
      this.drawPaw(ctx, r, this.pawParts?.right, pose.rightPress, pose.rightLift, "right");
    } else {
      this.drawPaw(ctx, r, this.pawParts?.right, pose.rightPress, pose.rightLift, "right");
      this.drawPaw(ctx, r, this.pawParts?.left, pose.leftPress, pose.leftLift, "left");
    }
    this.drawWaterBowl(ctx, r);
    this.drawLick(ctx, r);
    ctx.restore();
  }

  drawPaw(ctx, r, part, press, lift, side) {
    if (!part?.canvas) return;
    const sw = this.sprite.width;
    const sh = this.sprite.height;
    const px = (part.pivot.x / sw) * r.w - r.w / 2;
    const py = (part.pivot.y / sh) * r.h - r.h / 2;
    const dir = side === "left" ? -1 : 1;
    const typing = this.mode === "knead" ? 1 : Math.max(press, lift);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(dir * (lift * 0.62 - press * 0.18));
    ctx.scale(1 + press * 0.18 - lift * 0.08, 1 - press * 0.42 + lift * 0.16);
    ctx.translate(dir * typing * r.w * 0.02, lift * -r.h * 0.16 + press * r.h * 0.035);
    ctx.imageSmoothingEnabled = false;
    ctx.shadowOffsetY = 0;
    ctx.drawImage(part.canvas, -r.w / 2 - px, -r.h / 2 - py, r.w, r.h);
    ctx.restore();
  }

  drawWaterBowl(ctx, r) {
    const a = this.mode === "water" ? Math.min(1, this.modeT * 4, (4.05 - this.modeT) * 2.2) : this.bowlA;
    if (a <= 0.02) return;
    const u = Math.max(3, Math.round(this.pixelMul()));
    const sw = this.sprite?.width || GW;
    let face = 0.38 * sw;
    if (this.eyes?.length >= 2) face = (this.eyes[0].cx + this.eyes[1].cx) / 2;
    const bw = u * 18;
    const bh = u * 8;
    const x = (face / sw) * r.w - r.w / 2 - bw / 2;
    const y = r.h * 0.32;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = "#3a332c";
    ctx.fillRect(x + u, y + u, bw, bh);
    ctx.fillStyle = "#6b5d50";
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = "#2f7eb8";
    ctx.fillRect(x + u, y + u, bw - u * 2, bh - u * 2);
    ctx.fillStyle = "#7ec8f0";
    const ripple = Math.round(Math.sin(this.modeT * 14) * u * 0.4);
    ctx.fillRect(x + u * 2 + ripple, y + u, bw - u * 5, u);
    ctx.restore();
  }

  faceLocalX(r) {
    const sw = this.sprite?.width || GW;
    let face = 0.38 * sw;
    if (this.eyes?.length >= 2) face = (this.eyes[0].cx + this.eyes[1].cx) / 2;
    return (face / sw) * r.w - r.w / 2;
  }

  lickAmount() {
    if (this.mode !== "water" || this.modeT < 0.28 || this.modeT > 3.55) return 0;
    return Math.max(0, Math.sin(this.modeT * 12));
  }

  drawLick(ctx, r) {
    const extend = this.lickAmount();
    if (extend < 0.08) return;
    const u = Math.max(3, Math.round(this.pixelMul() * 0.7));
    const mx = this.faceLocalX(r) - u;
    const my = -r.h * 0.08;
    const bowlTop = r.h * 0.32;
    const maxLen = Math.max(u * 10, bowlTop - my + u);
    const len = u * 4 + extend * (maxLen - u * 4);
    ctx.save();
    ctx.shadowOffsetY = 0;
    drawPixelTongue(ctx, mx, my, u, len);
    if (extend > 0.72) {
      ctx.fillStyle = "#7ec8f0";
      ctx.fillRect(Math.round(mx + u), Math.round(my + len + u), u, u);
    }
    ctx.restore();
  }

  drawKeyboard(ctx, r) {
    const show = this.mode === "knead" || this.keys > 0.05;
    if (!show) return;
    const a = this.mode === "knead" ? Math.min(1, 0.55 + this.keys) : this.keys;
    const pose = this.pawPose();
    const highlight = pose.leftPress > pose.rightPress
      ? Math.floor((this.pawBeat * 4) % 7)
      : 7 + Math.floor((this.pawBeat * 4) % 8);
    const sw = this.sprite?.width || GW;
    let face = 0.38 * sw;
    if (this.eyes?.length >= 2) {
      face = (this.eyes[0].cx + this.eyes[1].cx) / 2;
    } else if (this.pawParts?.left && this.pawParts?.right) {
      face = (this.pawParts.left.pivot.x + this.pawParts.right.pivot.x) / 2;
    }
    const kbH = r.h * 0.13;
    const u = Math.max(2, Math.round(kbH / 8));
    const kbW = u * 16;
    const x = (face / sw) * r.w - r.w / 2 - kbW / 2;
    const y = r.h * 0.41;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowOffsetY = 0;
    drawPixelKeyboard(ctx, x, y, kbW, kbH, highlight);
    ctx.restore();
  }

  drawPixelExtras(ctx) {
    const s = this.settings, t = this.modeT;
    const rect = (x,y,w,h,color) => { ctx.fillStyle=color; ctx.fillRect(Math.round(x),Math.round(y),w,h); };
    const neck = this.mode === "sleep" ? 24 : 20;
    if (s.accessory !== "none" && !["stretch","water","sniff","sleep"].includes(this.mode)) {
      rect(10,neck,9,1,s.collarColor);
      if (s.accessory === "bow") {
        rect(10,neck+1,3,3,s.collarColor); rect(16,neck+1,3,3,s.collarColor); rect(13,neck+2,3,1,"#e6c582");
      } else if (s.accessory === "bandana") {
        for(let i=0;i<4;i++)rect(10+i,neck+1+i,9-i*2,1,s.collarColor);
      } else rect(14,neck+1,2,2,"#e8bf68");
    }
    if (this.mode === "groom") {
      const y=18+Math.round(Math.sin(t*7));
      rect(18,y,4,4,s.bellyColor);rect(17,y+1,1,2,s.furColor);
      if(Math.sin(t*7)>0)rect(16,y,2,1,s.innerEarColor);
    }
    if (this.mode === "toy") {
      rect(12,19,7,4,"#b17cca");rect(13,18,5,1,"#d9afe6");rect(14,19,2,4,"#f4cd78");
    }
    if (this.mode === "test") {
      rect(19,19,6,5,"#4c6e72");rect(20,20,4,3,"#b5e6d9");rect(24,23,2,4,"#4c6e72");
      rect(21,20+Math.round((Math.sin(t*5)+1)),2,1,"#536b83");
    }
  }

  drawRaster(ctx, r) {
    if (!this.sprite) {
      (this.settings.petKind === "dog" ? drawDogArt : drawCatArt)(this.bctx, this);
      this.drawPixelExtras(this.bctx);
      const data = this.bctx.getImageData(0, 0, GW, GH).data;
      this._lastGrid = Array.from({ length: GH }, (_, y) =>
        Uint8Array.from({ length: GW }, (_, x) => data[(y * GW + x) * 4 + 3] ? 1 : 0));
      ctx.save();
      ctx.fillStyle = "rgba(37,30,47,0.18)";
      ctx.beginPath();
      ctx.ellipse(r.x + r.w * 0.48, this.y + this.bodyH() * 0.94, r.w * (0.31 - this.hop * 0.06), this.pixelMul() * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(r.x + r.w / 2, r.y + r.h * 0.75);
      ctx.rotate(this.wobble + this.tilt + (this.vibing && this.settings.musicStyle !== "bob" ? Math.sin(this.tailT * (this.settings.musicStyle === "dance" ? 4 : 2.5)) * (this.settings.musicStyle === "dance" ? .10 : .04) : 0));
      if (this.mode === "chase") ctx.scale(Math.sin(this.modeT * 6) > 0 ? 1 : -1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.buf, -r.w / 2, -r.h * 0.75, r.w, r.h);
      ctx.restore();
      return;
    }
    const pose = {
      blink: this.mode === "sleep" ? 1 : this.blink,
      pupilX: this.pupilX || 0,
      pupilY: this.pupilY || 0,
      knead: this.mode === "knead" ? this.modeT * 6 : 0,
      think: this.mode === "think" || this.think,
      sleep: this.mode === "sleep",
      hop: this.hop,
      stretch: this.mode === "stretch",
      hunt: this.mode === "hunt" ? this.hunt : 0,
      paper: this.paper,
      overheat: this.overheat > 0,
      steam: this.steam | 0,
      hearts: this.pet,
      pawLift: 0,
      water: this.mode === "water",
      waterT: this.modeT,
      pattern: this.settings.pattern,
    };
    const g = raster(pose);
    this._lastGrid = g;
    const pal = this.palette();
    const data = this.pixels.data;
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const i = (y * GW + x) * 4;
        const id = g[y][x];
        if (id === EMPTY) {
          data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
        } else {
          const c = pal[id] || [0, 0, 0];
          data[i] = c[0];
          data[i + 1] = c[1];
          data[i + 2] = c[2];
          data[i + 3] = 255;
        }
      }
    }
    this.bctx.putImageData(this.pixels, 0, 0);
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.translate(0, r.h * 0.2);
    ctx.rotate(this.wobble + this.tilt);
    ctx.translate(0, -r.h * 0.2);
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = Math.max(2, this.settings.scale);
    ctx.drawImage(this.buf, -r.w / 2, -r.h / 2, r.w, r.h);
    ctx.restore();
  }

  drawEffects(ctx, r) {
    const mul = this.pixelMul();
    if (this.mode === "water" && this.modeT > 0.35 && this.modeT < 3.4) {
      const lick = this.lickAmount();
      if (lick > 0.35) {
        for (let i = 0; i < 4; i++) {
          const t = (this.modeT * 8 + i * 0.18) % 1;
          ctx.globalAlpha = (1 - t) * lick;
          ctx.fillStyle = "#7ec8f0";
          ctx.fillRect(
            r.x + r.w * 0.38 + (i - 1.5) * mul * 2,
            r.y + r.h * 0.58 + t * mul * 8,
            mul,
            mul
          );
          ctx.globalAlpha = 1;
        }
      }
    }
    if (this.mode === "sleep") {
      const z = Math.sin(this.idleT * 1.5);
      ctx.fillStyle = "#f4f4f0";
      const zx = r.x + r.w * 0.72;
      const zy = r.y + r.h * 0.08 - (z * 0.5 + 0.5) * mul * 4;
      ctx.fillRect(zx, zy, mul * 3, mul);
      ctx.fillRect(zx + mul, zy - mul * 3, mul * 2, mul);
      ctx.fillRect(zx + mul * 2, zy - mul * 6, mul, mul);
    }
    if (this.overheat > 0) {
      ctx.fillStyle = "rgba(230,230,230,0.85)";
      for (let i = 0; i < 5; i++) {
        const sx = r.x + r.w * 0.28 + i * mul * 2.4;
        const sy = r.y + r.h * 0.04 - ((this.steam + i) % 5) * mul;
        ctx.fillRect(sx, sy, mul, mul * 2);
      }
    }
    if (this.mode === "think" || this.think) {
      const u = Math.max(3, Math.round(mul * 1.15));
      const dots = 1 + (Math.floor(this.modeT * 2.4) % 3);
      const bw = u * 14;
      const bh = u * 9;
      let bx = r.x + r.w * 0.48;
      let by = r.y - bh - u * 2;
      if (bx + bw > this.display.w - 8) bx = Math.max(8, r.x + r.w - bw - u * 2);
      if (bx < 8) bx = 8;
      if (by < 8) by = r.y + u * 2;
      ctx.fillStyle = "#111";
      ctx.fillRect(r.x + r.w * 0.58, r.y + u * 2, u, u);
      ctx.fillRect(r.x + r.w * 0.64, r.y - u, u, u);
      ctx.fillRect(bx + u, by + u, bw, bh);
      ctx.fillStyle = "#f4f4f0";
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = "#1a1a1a";
      for (let i = 0; i < dots; i++) {
        ctx.fillRect(bx + u * 2 + i * u * 4, by + u * 3, u * 2, u * 2);
      }
    }
    for (const h of this.hearts) drawPixelHeart(ctx, h, mul);
    if (this.paper > 0 || this.mode === "paper") {
      const u = Math.max(3, Math.round(mul));
      const bat = this.mode === "paper" ? Math.max(0, Math.sin(this.modeT * 9)) : 0;
      const unroll = r.w * (0.16 + this.paper * 0.28);
      drawPixelToiletPaper(
        ctx,
        r.x + r.w * 0.02,
        r.y + r.h * 0.68 - bat * u * 2,
        u,
        unroll,
        this.paperSpin,
        Math.max(this.paper, this.mode === "paper" ? 0.35 : 0)
      );
    }
  }

  drawTimer(ctx, r) {
    const left = Math.max(0, this.pomodoro.left);
    const m = String(Math.floor(left / 60)).padStart(2, "0");
    const s = String(Math.floor(left % 60)).padStart(2, "0");
    const text = `${m}:${s}`;
    const px = 3;
    let ox = r.x - 8 - text.length * (px + 1) * 3;
    const oy = r.y + 10;
    ctx.fillStyle = this.pomodoro.phase === "break" ? "#7dffb1" : "#ffe56b";
    for (const ch of text) {
      const glyph = DIGITS[ch];
      if (!glyph) continue;
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 3; x++) {
          if (glyph[y][x] === "1") ctx.fillRect(ox + x * px, oy + y * px, px, px);
        }
      }
      ox += 4 * px;
    }
  }

  uiState() {
    const r = this.catRect();
    return {
      x: r.x,
      y: r.y,
      w: r.w,
      bubble: this.bubbleT > 0 ? this.bubble : "",
      pin: this.settings.pinnedMessage || "",
      mode: this.mode,
      agent: this.agentInfo || null,
    };
  }
}
