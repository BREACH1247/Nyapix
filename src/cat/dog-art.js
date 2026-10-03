import { drawPixelEye } from "./pixel-eyes.js";
import { drawCurledPet } from "./pixel-routines.js";
// Pixel rig: the ears, muzzle, paws and tail each follow their own motion.
export function drawDogArt(ctx, pet) {
  if (pet.mode === "sleep") { drawCurledPet(ctx, pet); return; }
  const s = pet.settings;
  const t = pet.tailT;
  const mode = pet.mode;
  const sleep = mode === "sleep";
  const happy = pet.pet > 0.2 || mode === "hop" || mode === "wave";
  const think = mode === "think";
  const reply = mode === "reply";
  const bow = mode === "stretch";
  const typing = mode === "knead" || mode === "edit";
  const walk = ["hunt","home","toy","chase"].includes(mode);
  const sniff = mode === "sniff" || (mode === "idle" && t % 14 > 12);
  const drink = mode === "water";
  const ink = "#322b36",
    cream = s.bellyColor,
    mark = s.markColor;
  const fur = pet.overheat > 0.4 ? "#d48669" : s.furColor;
  const rect = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const oval = (x, y, rx, ry, c) => {
    for (let yy = Math.ceil(y - ry); yy <= y + ry; yy++) {
      const dx = rx * Math.sqrt(Math.max(0, 1 - ((yy - y) / ry) ** 2));
      rect(
        Math.ceil(x - dx),
        yy,
        Math.floor(x + dx) - Math.ceil(x - dx) + 1,
        1,
        c,
      );
    }
  };
  const paw = (x, y, wave = false) => {
    oval(x, y, wave ? 2 : 3, wave ? 3 : 2, ink);
    oval(x, y - 0.5, wave ? 1 : 2, wave ? 2 : 1, cream);
    rect(x - 1, y + 1, 1, 1, mark);
    rect(x + 1, y + 1, 1, 1, mark);
    if (wave) rect(x, y, 1, 1, s.innerEarColor);
  };
  ctx.clearRect(0, 0, 32, 32);

  // A springy, short tail. Happiness changes its speed as well as its arc.
  const wag =
    Math.sin(t * (happy ? 19 : walk ? 12 : sleep ? 1.5 : 5)) *
    (happy ? 4 : sleep ? 0.5 : 2);
  for (const [radius, color] of [
    [2, ink],
    [1, fur],
  ]) {
    for (let i = 0; i <= 7; i++) {
      const u = i / 7;
      oval(
        22 + 5 * u + wag * u * 0.4,
        26 - u * 9 + wag * u * 0.45,
        radius,
        radius,
        color,
      );
    }
  }
  const bodyY = bow ? 23 : sleep ? 26 : 24;
  oval(15, bodyY, sleep || bow ? 9 : 7, sleep ? 4 : 6, ink);
  oval(
    15,
    bodyY - 0.5,
    sleep || bow ? 8 : 6,
    sleep ? 3 : 5 + Math.sin(t * 2) * 0.2,
    fur,
  );
  if (["saddle", "blacktan", "tabby", "siamese"].includes(s.pattern))
    oval(18, bodyY - 2, 4, 3, mark);
  oval(14, bodyY + 1, 4, 4, cream);
  if (s.pattern === "spotted") {
    rect(19, 24, 2, 2, mark);
    rect(9, 24, 2, 2, mark);
  }

  const headX = 14 + Math.round(pet.lookX);
  const headY = sleep
    ? 20
    : bow
      ? 20
      : sniff
        ? 17
        : drink
          ? 17 + Math.round(Math.sin(t * 10))
          : 13;
  const tilt = think
    ? Math.round(Math.sin(t * 1.7) * 1.2)
    : Math.round(pet.lookX * 0.7);
  // The far ear sits behind the head; the near ear flops independently.
  for (const side of [-1, 1]) {
    const flop = sleep
      ? 2
      : happy
        ? Math.round(Math.sin(t * 10 + side))
        : walk
          ? Math.round(Math.sin(pet.walkT))
          : 0;
    const ey = headY + tilt * side + flop;
    oval(headX + side * 8, ey, 3, 6, ink);
    oval(headX + side * 8, ey - 0.5, 2, 5, mark);
    rect(headX + side * 8, ey + 2, 1, 2, s.innerEarColor);
  }
  oval(headX, headY, 8, 7, ink);
  oval(headX, headY - 0.5, 7, 6, fur);
  if (s.pattern === "blacktan" || s.pattern === "siamese")
    oval(headX, headY - 2, 6, 4, mark);
  if (["patches", "calico", "cow"].includes(s.pattern))
    oval(headX - 4, headY - 1, 3, 4, mark);
  if (s.pattern === "blaze" || s.pattern === "tuxedo") {
    rect(headX - 1, headY - 5, 3, 7, cream);
    rect(headX, headY - 6, 1, 1, cream);
  }
  if (s.pattern === "spotted") {
    rect(headX - 3, headY - 5, 2, 2, mark);
    rect(headX + 4, headY - 3, 2, 2, mark);
  }
  if (s.pattern === "tabby") {
    rect(headX - 2, headY - 5, 1, 2, mark);
    rect(headX + 2, headY - 5, 1, 2, mark);
  }

  for (const side of [-1, 1]) {
    const x = headX + side * 4,
      y = headY - 1 + tilt * side;
    drawPixelEye(ctx, x, y, { blink: pet.blink, closed: sleep || (happy && Math.sin(t * 2) > .4), happy: happy && !sleep, lookX: pet.lookX, lookY: pet.lookY }, { outline: ink, white: s.eyeColor, pupil: s.pupilColor });
    if (!sleep && (think || mode === "waiting")) rect(x - 1, y - 4, 2, 1, mark);
  }
  oval(headX, headY + 3, 5, 3, cream);
  oval(
    headX,
    headY + 2 + (sniff ? Math.round(Math.sin(t * 15) * 0.5) : 0),
    2,
    1,
    s.noseColor,
  );
  rect(headX, headY + 3, 1, 2, ink);
  rect(headX - 2, headY + 4, 2, 1, ink);
  rect(headX + 1, headY + 4, 2, 1, ink);
  if (happy || reply || drink || (mode === "idle" && t % 9 > 6)) {
    const tongue = drink
      ? 2 + Math.round(Math.max(0, Math.sin(t * 12)) * 2)
      : 1 + Math.round((Math.sin(t * 5) + 1) * .5);
    rect(headX, headY + 5, 2, tongue, s.innerEarColor);
    rect(headX + 1, headY + 5, 1, 1, s.noseColor);
  }
  if (s.accessory !== "none" && !sleep && !bow && !drink && !sniff) {
    rect(headX - 4, headY + 7, 9, 1, s.collarColor || "#6d958d");
    rect(headX, headY + 8, 2, 2, "#e8bf68");
  }
  if (typing) {
    rect(5, 28, 19, 3, ink);
    rect(6, 28, 17, 2, "#c2bdd6");
    for (let i = 0; i < 8; i++)
      rect(
        7 + i * 2,
        28,
        1,
        1,
        i === Math.floor(pet.pawBeat) % 8 ? "#f8cc83" : "#817795",
      );
  }
  const stride = walk ? Math.sin(pet.walkT) * 2 : 0;
  const beat = Math.sin(pet.pawBeat * 2);
  paw(
    bow ? 6 : 10,
    typing ? 26 - Math.max(0, beat) * 3 : 28 - Math.max(0, stride),
  );
  paw(
    bow ? 22 : mode === "wave" ? 23 : 19,
    mode === "wave"
      ? 18 + Math.round(Math.sin(t * 9))
      : typing
        ? 26 - Math.max(0, -beat) * 3
        : mode === "paper"
          ? 25 - Math.max(0, Math.sin(t * 9)) * 2
          : 28 - Math.max(0, -stride),
    mode === "wave",
  );
  if (drink) {
    rect(8, 28, 14, 3, ink);
    rect(9, 28, 12, 2, "#83caca");
    rect(10 + Math.round(Math.sin(t * 12)), 28, 5, 1, "#d5f6eb");
  }
}
