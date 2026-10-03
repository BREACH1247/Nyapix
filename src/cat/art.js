// A tiny articulated character, drawn on an integer pixel grid.
// Each part has its own pose; markings stay attached to the anatomy.
const mix = (a, b, t) => {
  const rgb = (h) => h.match(/[a-f\d]{2}/gi).map((v) => parseInt(v, 16));
  const x = rgb(a),
    y = rgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};

export function drawCatArt(ctx, cat) {
  if (cat.mode === "sleep") { drawCurledPet(ctx, cat); return; }
  const s = cat.settings;
  const t = cat.idleT;
  const mode = cat.mode;
  const sleeping = mode === "sleep";
  const happy = cat.pet > 0.2 || mode === "hop";
  const typing = mode === "knead" || mode === "edit";
  const hunting = ["hunt","home","toy","chase"].includes(mode);
  const stretching = mode === "stretch";
  const drinking = mode === "water";
  const heat = Math.min(1, cat.overheat) * 0.6;
  const fur = mix(s.furColor, "#ed746a", heat);
  const shade = mix(s.furColor, "#322c42", 0.26);
  const light = mix(s.furColor, "#fff1de", 0.2);
  const outline = "#302b3c";
  const mark = s.markColor;
  const cream = s.bellyColor;
  ctx.clearRect(0, 0, 32, 32);
  const rect = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const ellipse = (x, y, rx, ry, c) => {
    for (let yy = Math.ceil(y - ry); yy <= y + ry; yy++) {
      const half = rx * Math.sqrt(Math.max(0, 1 - ((yy - y) / ry) ** 2));
      rect(
        Math.ceil(x - half),
        yy,
        Math.floor(x + half) - Math.ceil(x - half) + 1,
        1,
        c,
      );
    }
  };
  const poly = (points, c) => {
    const ys = points.map((p) => p[1]);
    for (let y = Math.ceil(Math.min(...ys)); y <= Math.max(...ys); y++) {
      const hits = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i],
          b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          hits.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
        }
      }
      hits.sort((a, b) => a - b);
      for (let i = 0; i + 1 < hits.length; i += 2) {
        rect(
          Math.ceil(hits[i]),
          y,
          Math.floor(hits[i + 1]) - Math.ceil(hits[i]) + 1,
          1,
          c,
        );
      }
    }
  };
  const paw = (x, y, lifted) => {
    ellipse(x, y, lifted ? 2 : 3, lifted ? 3 : 2, outline);
    ellipse(x, y - 0.5, lifted ? 1 : 2, lifted ? 2 : 1, cream);
    if (lifted && stretching) rect(x, y, 1, 1, s.innerEarColor);
    else {
      rect(x - 1, y + 1, 1, 1, shade);
      rect(x + 1, y + 1, 1, 1, shade);
    }
  };

  // The curved tail is a chain of pixel discs, never detached by rotation.
  const wag = cat.tailAngle * (sleeping ? 1 : 3);
  for (let i = 0; i < 10; i++) {
    const u = i / 9;
    const x = 22 + Math.sin(u * 2.1) * 5 + wag * u;
    const y = 27 - u * 12 + Math.cos(t * 2) * u;
    ellipse(x, y, 2.1, 2, outline);
  }
  for (let i = 0; i < 10; i++) {
    const u = i / 9;
    const x = 22 + Math.sin(u * 2.1) * 5 + wag * u;
    const y = 27 - u * 12 + Math.cos(t * 2) * u;
    ellipse(x, y, 1.1, 1, s.pattern === "tabby" && i % 4 === 0 ? mark : fur);
  }

  const breath = Math.sin(t * (sleeping ? 1.7 : 2.4));
  const by = hunting ? 25 : 24;
  ellipse(15, by, hunting ? 10 : 8, sleeping ? 5 : 6 + breath * 0.35, outline);
  ellipse(15, by - 0.5, hunting ? 9 : 7, sleeping ? 4 : 5, fur);
  ellipse(15, by + 1, 5, 4, shade);
  ellipse(14, by, 4, 4, cream);

  const nod = drinking ? Math.round(Math.max(0, Math.sin(cat.modeT * 12))) : 0;
  const headX = 14 + Math.round(cat.lookX * 0.8);
  const headY = (sleeping ? 17 : hunting ? 16 : stretching ? 11 : 13) + nod;
  const twitch = Math.sin(t * 1.4) > 0.985 ? 1 : 0;
  const ears = (inner) => {
    const c = inner ? s.innerEarColor : outline;
    poly(
      [
        [headX - 9 + (inner ? 1 : 0), headY - 3],
        [headX - 8, headY - 11 + twitch],
        [headX - 2, headY - 5],
      ],
      c,
    );
    poly(
      [
        [headX + 2, headY - 5],
        [headX + 8, headY - 11 - twitch],
        [headX + 9 - (inner ? 1 : 0), headY - 3],
      ],
      c,
    );
  };
  ears(false);
  poly(
    [
      [headX - 8, headY - 3],
      [headX - 7, headY - 9 + twitch],
      [headX - 3, headY - 4],
    ],
    fur,
  );
  poly(
    [
      [headX + 3, headY - 4],
      [headX + 7, headY - 9 - twitch],
      [headX + 8, headY - 3],
    ],
    fur,
  );
  poly(
    [
      [headX - 7, headY - 4],
      [headX - 7, headY - 7 + twitch],
      [headX - 4, headY - 4],
    ],
    s.innerEarColor,
  );
  poly(
    [
      [headX + 4, headY - 4],
      [headX + 7, headY - 7 - twitch],
      [headX + 7, headY - 4],
    ],
    s.innerEarColor,
  );
  ellipse(headX, headY, 10, 7, outline);
  ellipse(headX, headY - 0.5, 9, 6, fur);
  rect(headX - 5, headY - 5, 6, 1, light);
  rect(headX - 7, headY - 3, 2, 1, light);

  // Broad, deliberate patches instead of noise across individual pixels.
  if (s.pattern === "tabby") {
    rect(headX - 1, headY - 6, 2, 3, mark);
    rect(headX - 4, headY - 5, 1, 2, mark);
    rect(headX + 3, headY - 5, 1, 2, mark);
    rect(headX - 8, headY + 1, 2, 1, mark);
    rect(headX + 7, headY + 1, 2, 1, mark);
  } else if (s.pattern === "calico" || s.pattern === "cow") {
    ellipse(headX - 4, headY - 2, 4, 3, s.pattern === "cow" ? cream : mark);
    ellipse(headX + 5, headY - 3, 3, 2, cream);
  } else if (s.pattern === "siamese") {
    ellipse(headX, headY + 1, 7, 4, mark);
  } else if (s.pattern === "spotted") {
    rect(headX - 4, headY - 4, 2, 2, mark);
    rect(headX + 3, headY - 3, 2, 2, mark);
    rect(headX - 7, headY + 2, 2, 1, mark);
  }
  ellipse(headX, headY + 3, s.pattern === "tuxedo" ? 4 : 3, 2, cream);

  for (const ex of [headX - 5, headX + 5]) {
    drawPixelEye(ctx, ex, headY, { blink: cat.blink, closed: sleeping || happy, happy: happy && !sleeping, lookX: cat.lookX, lookY: cat.lookY }, { outline, white: s.eyeColor, pupil: s.pupilColor });
  }
  rect(headX - 1, headY + 2, 3, 1, s.noseColor);
  rect(headX, headY + 3, 1, 1, outline);
  rect(headX - 1, headY + 4, 1, 1, outline);
  rect(headX + 1, headY + 4, 1, 1, outline);
  rect(headX - 9, headY + 3, 3, 1, light);
  rect(headX + 7, headY + 3, 3, 1, light);
  if (happy) {
    rect(headX - 7, headY + 2, 2, 1, s.innerEarColor);
    rect(headX + 6, headY + 2, 2, 1, s.innerEarColor);
  }
  if (mode === "reply") rect(headX, headY + 4, 1, 1 + Math.round(Math.max(0, Math.sin(cat.tailT * 9))), s.innerEarColor);
  if (mode === "waiting") {
    rect(headX - 6, headY - 4, 3, 1, mark);
    rect(headX + 4, headY - 5, 3, 1, mark);
  }

  if (typing) {
    rect(5, 28, 19, 3, outline);
    rect(6, 28, 17, 2, "#c2bdd6");
    for (let i = 0; i < 8; i++)
      rect(
        7 + i * 2,
        28,
        1,
        1,
        i === Math.floor(cat.pawBeat) % 8 ? "#f8cc83" : "#817795",
      );
  }
  const beat = Math.sin(cat.pawBeat * 2);
  const stride = hunting ? Math.sin(cat.walkT) * 2 : 0;
  paw(
    stretching ? 5 : 10,
    stretching
      ? 10
      : typing
        ? 26 - Math.max(0, beat) * 3
        : 28 - Math.max(0, stride),
    stretching || (typing && beat > 0.3),
  );
  paw(
    stretching ? 24 : 19,
    stretching
      ? 10
      : typing
        ? 26 - Math.max(0, -beat) * 3
        : mode === "paper"
          ? 26 - Math.max(0, Math.sin(cat.modeT * 9)) * 3
          : 28 - Math.max(0, -stride),
    stretching || (typing && beat < -0.3),
  );
  if (drinking) {
    rect(8, 28, 14, 3, outline);
    rect(9, 28, 12, 2, "#83caca");
    rect(10 + Math.round(Math.sin(cat.modeT * 10)), 28, 4, 1, "#d5f6eb");
    if (Math.sin(cat.modeT * 12) > 0.2)
      rect(headX, headY + 5, 1, 3, s.noseColor);
  }
}
import { drawPixelEye } from "./pixel-eyes.js";
import { drawCurledPet } from "./pixel-routines.js";
