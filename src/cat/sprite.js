function dist(r, g, b, r2, g2, b2) {
  return Math.hypot(r - r2, g - g2, b - b2);
}

function hexToRgb(hex) {
  const n = String(hex || "#888888").replace("#", "");
  const v = parseInt(n.length === 3 ? n.split("").map((c) => c + c).join("") : n, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mixRgb(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function rgbToHex(rgb) {
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function classifyPixel(r, g, b) {
  const luma = (r + g + b) / 3;
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  if (luma < 42) return "outline";
  if (r > 160 && g < 80 && b < 80 && Math.abs(g - b) < 30) return "accent";
  if (r > 140 && r > g + 18 && r > b + 18 && g < b + 36 && luma < 220) return "pink";
  if (luma > 200 && sat < 48) return "white";
  if (luma > 168 && sat < 36) return "white";
  return "fur";
}

export function sampleNativeColors(imageData) {
  const { width: w, height: h, data } = imageData;
  const buckets = { fur: [0, 0, 0, 0], mark: [0, 0, 0, 0], white: [0, 0, 0, 0], pink: [0, 0, 0, 0] };
  let furMin = 255;
  let furMax = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const kind = classifyPixel(r, g, b);
    const luma = (r + g + b) / 3;
    if (kind === "fur") {
      furMin = Math.min(furMin, luma);
      furMax = Math.max(furMax, luma);
      const bucket = luma < 110 ? "mark" : "fur";
      buckets[bucket][0] += r;
      buckets[bucket][1] += g;
      buckets[bucket][2] += b;
      buckets[bucket][3]++;
    } else if (kind === "white" || kind === "pink") {
      buckets[kind][0] += r;
      buckets[kind][1] += g;
      buckets[kind][2] += b;
      buckets[kind][3]++;
    }
  }
  const avg = (k, fallback) => {
    const t = buckets[k][3];
    if (!t) return fallback;
    return rgbToHex([
      Math.round(buckets[k][0] / t),
      Math.round(buckets[k][1] / t),
      Math.round(buckets[k][2] / t),
    ]);
  };
  return {
    furColor: avg("fur", "#a3a3a3"),
    markColor: avg("mark", "#5e5e5e"),
    bellyColor: avg("white", "#ffffff"),
    innerEarColor: avg("pink", "#f3a8b5"),
    noseColor: avg("pink", "#f3a8b5"),
    furMin: furMin === 255 ? 70 : furMin,
    furMax: furMax === 0 ? 180 : furMax,
  };
}

export function cloneImageData(imageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

export function recolorSprite(imageData, settings, native) {
  const { width: w, height: h, data } = imageData;
  const out = new Uint8ClampedArray(data);
  const fur = hexToRgb(settings.furColor);
  const mark = hexToRgb(settings.markColor);
  const belly = hexToRgb(settings.bellyColor);
  const inner = hexToRgb(settings.innerEarColor);
  const nose = hexToRgb(settings.noseColor);
  const calico = hexToRgb(settings.markColor || "#d37a32");
  const pattern = settings.pattern || "tabby";
  const minL = native?.furMin ?? 70;
  const maxL = Math.max(minL + 8, native?.furMax ?? 180);
  const span = maxL - minL;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (out[i + 3] < 16) continue;
      const kind = classifyPixel(out[i], out[i + 1], out[i + 2]);
      if (kind === "outline" || kind === "accent") continue;
      let rgb = null;
      if (kind === "pink") {
        rgb = y < h * 0.3 ? inner : nose;
      } else if (kind === "white") {
        rgb = belly;
      } else {
        let t = ( (out[i] + out[i + 1] + out[i + 2]) / 3 - minL ) / span;
        t = Math.max(0, Math.min(1, t));
        if (pattern === "solid") t = 0.62 + t * 0.28;
        rgb = mixRgb(mark, fur, t);
        if (pattern === "tuxedo" && y > h * 0.34 && y < h * 0.78 && x > w * 0.26 && x < w * 0.64) {
          rgb = belly;
        } else if (pattern === "calico") {
          const hv = hash(x, y);
          if (hv > 0.72) rgb = calico;
          else if (hv > 0.5 && x < w * 0.5) rgb = belly;
        } else if (pattern === "siamese") {
          const point = y < h * 0.22 || y > h * 0.78 || x < w * 0.16 || x > w * 0.78 || (x - w * 0.38) ** 2 + (y - h * 0.28) ** 2 < (w * 0.12) ** 2;
          if (point) rgb = mixRgb(rgb, mark, 0.7);
        } else if (pattern === "spotted") {
          if (hash(Math.floor(x / 3), Math.floor(y / 3)) > 0.78) rgb = mark;
        } else if (pattern === "cow") {
          if (hash(Math.floor(x / 5), Math.floor(y / 5)) > 0.55) rgb = belly;
        }
      }
      if (!rgb) continue;
      out[i] = rgb[0];
      out[i + 1] = rgb[1];
      out[i + 2] = rgb[2];
    }
  }
  return new ImageData(out, w, h);
}

function isUniformBlocks(data, w, h, s) {
  let checks = 0;
  let ok = 0;
  for (let y = 0; y <= h - s; y += s) {
    for (let x = 0; x <= w - s; x += s) {
      const i0 = (y * w + x) * 4;
      let same = true;
      for (let dy = 0; dy < s && same; dy++) {
        for (let dx = 0; dx < s; dx++) {
          const i = ((y + dy) * w + x + dx) * 4;
          if (
            Math.abs(data[i] - data[i0]) > 10 ||
            Math.abs(data[i + 1] - data[i0 + 1]) > 10 ||
            Math.abs(data[i + 2] - data[i0 + 2]) > 10 ||
            Math.abs(data[i + 3] - data[i0 + 3]) > 10
          ) {
            same = false;
          }
        }
      }
      checks++;
      if (same) ok++;
    }
  }
  return checks > 8 && ok / checks > 0.82;
}

function guessScale(data, w, h) {
  if (Math.max(w, h) < 80) return 1;
  for (const s of [16, 12, 10, 8, 6, 5, 4, 3, 2]) {
    if (w < s * 8 || h < s * 8) continue;
    if (isUniformBlocks(data, w, h, s)) return s;
  }
  return 1;
}

function isSky(r, g, b, br, bg, bb) {
  if (dist(r, g, b, br, bg, bb) < 58) return true;
  const lum = (r + g + b) / 3;
  return b > r + 12 && g > r + 4 && lum > 155 && Math.abs(r - g) > 6;
}

function floodKey(data, w, h, br, bg, bb) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    seen[idx] = 1;
    const p = idx * 4;
    if (data[p + 3] < 8) return;
    if (isSky(data[p], data[p + 1], data[p + 2], br, bg, bb)) stack.push(x, y);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    const p = (y * w + x) * 4;
    data[p + 3] = 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
}

export function prepareSprite(img) {
  const src = document.createElement("canvas");
  src.width = img.width;
  src.height = img.height;
  const sctx = src.getContext("2d");
  sctx.drawImage(img, 0, 0);
  const raw = sctx.getImageData(0, 0, img.width, img.height);
  const d = raw.data;
  const br = d[0];
  const bg = d[1];
  const bb = d[2];
  floodKey(d, img.width, img.height, br, bg, bb);

  let minX = img.width;
  let minY = img.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (d[i + 3] < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  sctx.putImageData(raw, 0, 0);

  if (maxX <= minX || maxY <= minY) return src;

  const pad = 1;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(img.width - 1, maxX + pad);
  maxY = Math.min(img.height - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const cropped = document.createElement("canvas");
  cropped.width = cw;
  cropped.height = ch;
  cropped.getContext("2d").drawImage(src, minX, minY, cw, ch, 0, 0, cw, ch);
  const cd = cropped.getContext("2d").getImageData(0, 0, cw, ch);
  const scale = guessScale(cd.data, cw, ch);
  if (scale <= 1) return cropped;
  return downsampleBlocks(cd, scale);
}

function downsampleBlocks(imageData, scale) {
  const { width: w, height: h, data } = imageData;
  const nw = Math.max(1, Math.floor(w / scale));
  const nh = Math.max(1, Math.floor(h / scale));
  const out = document.createElement("canvas");
  out.width = nw;
  out.height = nh;
  const dst = out.getContext("2d").createImageData(nw, nh);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const sx = x * scale + dx;
          const sy = y * scale + dy;
          if (sx >= w || sy >= h) continue;
          const i = (sy * w + sx) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
          n++;
        }
      }
      const o = (y * nw + x) * 4;
      dst.data[o] = Math.round(r / n);
      dst.data[o + 1] = Math.round(g / n);
      dst.data[o + 2] = Math.round(b / n);
      dst.data[o + 3] = Math.round(a / n);
    }
  }
  out.getContext("2d").putImageData(dst, 0, 0);
  return out;
}

function isDarkPx(data, w, x, y) {
  const i = (y * w + x) * 4;
  return data[i + 3] > 180 && data[i] < 48 && data[i + 1] < 48 && data[i + 2] < 48;
}

export function findEyes(imageData) {
  const { width: w, height: h, data } = imageData;
  const visited = new Uint8Array(w * h);
  const clusters = [];
  const yMax = Math.floor(h * 0.52);
  for (let y = 2; y < yMax; y++) {
    for (let x = 2; x < w - 2; x++) {
      const idx = y * w + x;
      if (visited[idx] || !isDarkPx(data, w, x, y)) continue;
      const q = [[x, y]];
      visited[idx] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let n = 0;
      let sx = 0;
      let sy = 0;
      let edge = false;
      while (q.length) {
        const [cx, cy] = q.pop();
        n++;
        sx += cx;
        sy += cy;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        if (cx <= 1 || cy <= 1 || cx >= w - 2) edge = true;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nidx = ny * w + nx;
          if (visited[nidx] || !isDarkPx(data, w, nx, ny)) continue;
          visited[nidx] = 1;
          q.push([nx, ny]);
        }
      }
      if (edge || n < 8 || n > 140) continue;
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      if (bw < 3 || bh < 3 || bw > w * 0.28 || bh > h * 0.2) continue;
      if (bh > bw * 2.2 || bw > bh * 2.2) continue;
      clusters.push({ minX, maxX, minY, maxY, n, cx: sx / n, cy: sy / n });
    }
  }
  let best = null;
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i];
      const b = clusters[j];
      const left = a.cx < b.cx ? a : b;
      const right = a.cx < b.cx ? b : a;
      const gap = right.cx - left.cx;
      if (gap < Math.max(6, w * 0.08)) continue;
      if (Math.abs(a.cy - b.cy) > h * 0.1) continue;
      const score = a.n + b.n + gap * 0.4 - Math.abs(a.cy - b.cy) * 4 - (a.cy + b.cy) * 0.15;
      if (!best || score > best.score) best = { score, eyes: [left, right] };
    }
  }
  return best ? best.eyes : [];
}

export function findEyeHighlights(imageData) {
  const { width: w, height: h, data } = imageData;
  const hits = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 200) continue;
      if (data[i] < 220 || data[i + 1] < 220 || data[i + 2] < 220) continue;
      let dark = 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) {
        const j = ((y + dy) * w + x + dx) * 4;
        if (data[j + 3] > 80 && data[j] < 50 && data[j + 1] < 50 && data[j + 2] < 50) dark++;
      }
      if (dark >= 3) hits.push({ x, y });
    }
  }
  return hits;
}

export function splitTail(imageData) {
  const { width: w, height: h, data } = imageData;
  let cut = Math.floor(w * 0.72);
  for (let x = w - 1; x >= Math.floor(w * 0.42); x--) {
    let n = 0;
    for (let y = 0; y < h; y++) {
      if (data[(y * w + x) * 4 + 3] > 16) n++;
    }
    if (n > h * 0.4) {
      cut = x + 1;
      break;
    }
  }
  const tailMask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = cut; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) tailMask[y * w + x] = 1;
    }
  }
  let count = 0;
  let px = 0;
  let py = 0;
  let pn = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!tailMask[y * w + x]) continue;
      count++;
      if (x <= cut + 3) {
        px += x;
        py += y;
        pn++;
      }
    }
  }
  if (count < 12) return null;

  const body = document.createElement("canvas");
  const tail = document.createElement("canvas");
  body.width = tail.width = w;
  body.height = tail.height = h;
  const bctx = body.getContext("2d");
  const tctx = tail.getContext("2d");
  const bodyImg = bctx.createImageData(w, h);
  const tailImg = tctx.createImageData(w, h);
  bodyImg.data.set(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!tailMask[y * w + x]) continue;
      tailImg.data[i] = data[i];
      tailImg.data[i + 1] = data[i + 1];
      tailImg.data[i + 2] = data[i + 2];
      tailImg.data[i + 3] = data[i + 3];
      if (x >= cut + 3) bodyImg.data[i + 3] = 0;
    }
  }
  bctx.putImageData(bodyImg, 0, 0);
  tctx.putImageData(tailImg, 0, 0);
  return {
    body,
    tail,
    pivot: {
      x: pn ? px / pn : cut,
      y: pn ? py / pn : h * 0.55,
    },
    cut,
  };
}

export function splitPaws(imageData) {
  const { width: w, height: h, data } = imageData;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 16;
  const lumaOf = (x, y) => {
    const i = (y * w + x) * 4;
    return (data[i] + data[i + 1] + data[i + 2]) / 3;
  };
  const isWhite = (x, y) => {
    if (!opaque(x, y)) return false;
    const i = (y * w + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = (r + g + b) / 3;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    return luma > 165 && sat < 58;
  };

  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!opaque(x, y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxY <= minY) return null;

  const bh = maxY - minY + 1;
  const pawTop = maxY - Math.max(5, Math.round(bh * 0.13));
  const xLimit = Math.min(maxX, Math.floor(w * 0.7));
  const whiteCols = [];
  for (let x = minX; x <= xLimit; x++) {
    let white = 0;
    let fur = 0;
    for (let y = pawTop; y < maxY; y++) {
      if (!opaque(x, y)) continue;
      if (isWhite(x, y)) white++;
      else if (lumaOf(x, y) > 50) fur++;
    }
    if (white >= 1 && white >= fur) whiteCols.push(x);
  }
  if (whiteCols.length < 3) return null;

  const pawL = whiteCols[0];
  const pawR = whiteCols[whiteCols.length - 1];
  const x0 = Math.max(0, pawL - 1);
  const x1 = Math.min(w - 1, pawR + 1);
  const mid = (pawL + pawR) / 2;
  let splitX = Math.round(mid);
  let bestDark = -1;
  for (let x = Math.floor(mid - 2); x <= Math.ceil(mid + 2); x++) {
    if (x < x0 || x > x1) continue;
    let dark = 0;
    for (let y = pawTop; y <= maxY; y++) {
      if (opaque(x, y) && lumaOf(x, y) < 50) dark++;
    }
    if (dark > bestDark) {
      bestDark = dark;
      splitX = x;
    }
  }

  const stump = 1;
  const leftMask = new Uint8Array(w * h);
  const rightMask = new Uint8Array(w * h);
  for (let y = pawTop; y <= maxY; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!opaque(x, y)) continue;
      const mask = x < splitX ? leftMask : rightMask;
      mask[y * w + x] = 1;
    }
  }

  function extract(mask) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const img = canvas.getContext("2d").createImageData(w, h);
    let px = 0;
    let pn = 0;
    let minPy = h;
    let maxPy = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        const i = (y * w + x) * 4;
        img.data[i] = data[i];
        img.data[i + 1] = data[i + 1];
        img.data[i + 2] = data[i + 2];
        img.data[i + 3] = data[i + 3];
        px += x;
        pn++;
        if (y < minPy) minPy = y;
        if (y > maxPy) maxPy = y;
      }
    }
    if (pn < 6) return null;
    canvas.getContext("2d").putImageData(img, 0, 0);
    return {
      canvas,
      image: img,
      pivot: { x: px / pn, y: minPy + 0.5 },
      tipY: maxPy,
      minY: minPy,
    };
  }

  const left = extract(leftMask);
  const right = extract(rightMask);
  if (!left && !right) return null;

  const body = document.createElement("canvas");
  body.width = w;
  body.height = h;
  const bodyImg = body.getContext("2d").createImageData(w, h);
  bodyImg.data.set(data);
  for (let y = pawTop + stump; y <= maxY; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!leftMask[y * w + x] && !rightMask[y * w + x]) continue;
      bodyImg.data[(y * w + x) * 4 + 3] = 0;
    }
  }
  body.getContext("2d").putImageData(bodyImg, 0, 0);
  return { body, left, right };
}

export function drawPixelToiletPaper(ctx, x, y, unit, unroll, spin, alpha = 1) {
  const u = Math.max(2, Math.round(unit));
  const ox = Math.round(x);
  const oy = Math.round(y);
  const rollW = u * 12;
  const rollH = u * 11;
  const sheetW = Math.max(u * 8, Math.round(unroll));
  const sheetH = u * 3;
  const phase = ((spin % 1) + 1) % 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(ox + u, oy + rollH - u, rollW + sheetW - u * 2, u);
  ctx.fillStyle = "#2a241c";
  ctx.fillRect(ox, oy, rollW, rollH);
  ctx.fillStyle = "#f4efe4";
  ctx.fillRect(ox + u, oy + u, rollW - u * 2, rollH - u * 2);
  ctx.fillStyle = "#e2d6c0";
  const stripe = Math.round(phase * u * 3);
  for (let i = 0; i < 4; i++) {
    const sy = oy + u + ((i * u * 2 + stripe) % Math.max(u, rollH - u * 2));
    if (sy >= oy + u && sy < oy + rollH - u) ctx.fillRect(ox + u, sy, rollW - u * 2, u);
  }
  ctx.fillStyle = "#8d6a42";
  ctx.fillRect(ox + u * 3, oy + u * 3, u * 6, u * 5);
  ctx.fillStyle = "#c9a36a";
  ctx.fillRect(ox + u * 4, oy + u * 4, u * 4, u * 3);
  ctx.fillStyle = "#5a3f24";
  ctx.fillRect(ox + u * 5, oy + u * 5, u * 2, u * 2);
  const sx = ox + rollW - u;
  const sy = oy + u * 3 + Math.round(Math.sin(phase * Math.PI * 2) * u * 0.4);
  ctx.fillStyle = "#2a241c";
  ctx.fillRect(sx, sy + u, sheetW, sheetH);
  ctx.fillStyle = "#f7f2e6";
  ctx.fillRect(sx, sy, sheetW, sheetH);
  ctx.fillStyle = "#d4c8b0";
  const dash = u * 4;
  const off = Math.round(phase * dash);
  for (let px = off; px < sheetW - u; px += dash) {
    ctx.fillRect(sx + px, sy + u, u, u);
  }
  ctx.fillStyle = "#efe6d4";
  ctx.fillRect(sx + sheetW - u, sy - u, u * 2, sheetH + u);
  ctx.fillStyle = "#2a241c";
  ctx.fillRect(sx + sheetW + u, sy, u, sheetH - u);
  ctx.restore();
}

export function drawPixelTongue(ctx, x, y, unit, length) {
  const u = Math.max(2, Math.round(unit));
  const ox = Math.round(x);
  const oy = Math.round(y);
  const len = Math.max(u * 3, Math.round(length));
  ctx.fillStyle = "#9a3d55";
  ctx.fillRect(ox, oy, u * 4, u * 2);
  ctx.fillRect(ox + u, oy + u * 2, u * 2, len - u * 2);
  ctx.fillRect(ox + u, oy + len, u * 2, u);
  ctx.fillStyle = "#f48aa3";
  ctx.fillRect(ox + u, oy, u * 2, u * 2);
  ctx.fillRect(ox + u, oy + u * 2, u * 2, len - u * 2);
  ctx.fillRect(ox + u, oy + len, u, u);
  ctx.fillStyle = "#ffb3c4";
  ctx.fillRect(ox + u, oy + u, u, Math.max(u, len - u * 3));
}

export function drawPixelKeyboard(ctx, x, y, w, h, highlight = -1) {
  const u = Math.max(2, Math.round(h / 8));
  const rows = 3;
  const cols = 5;
  const caseW = u * (cols * 3 + 1);
  const caseH = u * (rows * 2 + 2);
  const ox = Math.round(x);
  const oy = Math.round(y);
  ctx.fillStyle = "#1a1612";
  ctx.fillRect(ox + u, oy + u, caseW, caseH);
  ctx.fillStyle = "#3a3228";
  ctx.fillRect(ox, oy, caseW, caseH);
  ctx.fillStyle = "#2c261e";
  ctx.fillRect(ox + u, oy + u, caseW - u, caseH - u);
  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const kx = ox + u + col * u * 3;
      const ky = oy + u + row * u * 2;
      const on = i === highlight;
      ctx.fillStyle = on ? "#c9a45a" : "#8a7a5c";
      ctx.fillRect(kx, ky + Math.max(1, u - 1), u * 2, Math.max(1, u - 1));
      ctx.fillStyle = on ? "#fff1c4" : "#efe6d2";
      ctx.fillRect(kx, ky, u * 2, Math.max(1, u - 1));
      i++;
    }
  }
}

export function applyEyes(imageData, eyes, lookX, lookY, blink, sleep, colors = {}) {
  if (!eyes?.length) return imageData;
  const { width: w, height: h, data } = imageData;
  const copy = new Uint8ClampedArray(data);
  const lx = Math.max(-1, Math.min(1, lookX || 0));
  const ly = Math.max(-1, Math.min(1, lookY || 0));
  const closed = sleep || blink > 0.55;
  const sclera = hexToRgb(colors.eyeColor || "#f7f7f4");
  const pupil = hexToRgb(colors.pupilColor || "#171717");

  for (const eye of eyes) {
    const minX = eye.minX;
    const maxX = eye.maxX;
    const minY = eye.minY;
    const maxY = eye.maxY;
    const ew = maxX - minX + 1;
    const eh = maxY - minY + 1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = (y * w + x) * 4;
        if (copy[i + 3] < 80) continue;
        if (closed) {
          const lid = y > minY + eh * 0.45 && y < maxY - eh * 0.15;
          copy[i] = lid ? 28 : 18;
          copy[i + 1] = lid ? 28 : 18;
          copy[i + 2] = lid ? 28 : 18;
        } else {
          copy[i] = sclera[0];
          copy[i + 1] = sclera[1];
          copy[i + 2] = sclera[2];
        }
      }
    }
    if (closed) continue;
    const pw = Math.max(2, Math.round(ew * 0.52));
    const ph = Math.max(2, Math.round(eh * 0.52));
    const ox = Math.round(lx * Math.max(1, (ew - pw) * 0.5));
    const oy = Math.round(ly * Math.max(1, (eh - ph) * 0.5));
    const px = minX + Math.floor((ew - pw) / 2) + ox;
    const py = minY + Math.floor((eh - ph) / 2) + oy;
    for (let y = py; y < py + ph; y++) {
      for (let x = px; x < px + pw; x++) {
        if (x < minX || y < minY || x > maxX || y > maxY) continue;
        const i = (y * w + x) * 4;
        copy[i] = pupil[0];
        copy[i + 1] = pupil[1];
        copy[i + 2] = pupil[2];
        copy[i + 3] = 255;
      }
    }
    const hx = Math.max(minX, Math.min(maxX, px + (lx < 0 ? pw - 1 : 0)));
    const hy = Math.max(minY, Math.min(maxY, py));
    const hi = (hy * w + hx) * 4;
    copy[hi] = copy[hi + 1] = copy[hi + 2] = 255;
    copy[hi + 3] = 255;
  }
  return new ImageData(copy, w, h);
}

const FONT = {
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "010"],
  K: ["101", "101", "110", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "101", "101", "101"],
  N: ["110", "101", "101", "101", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "110", "001"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "010"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "101", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
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
  "␣": ["000", "000", "000", "000", "111"],
  "↵": ["001", "001", "111", "100", "100"],
  "⌫": ["001", "011", "111", "011", "001"],
  "⇧": ["010", "111", "010", "010", "010"],
  "←": ["010", "100", "111", "100", "010"],
  "→": ["010", "001", "111", "001", "010"],
  "↑": ["010", "111", "010", "010", "010"],
  "↓": ["010", "010", "010", "111", "010"],
  "-": ["000", "000", "111", "000", "000"],
  "=": ["000", "111", "000", "111", "000"],
  ".": ["000", "000", "000", "000", "010"],
  ",": ["000", "000", "000", "010", "100"],
  "/": ["001", "001", "010", "100", "100"],
  ";": ["000", "010", "000", "010", "100"],
  "'": ["010", "010", "000", "000", "000"],
  "[": ["011", "010", "010", "010", "011"],
  "]": ["110", "010", "010", "010", "110"],
  "•": ["000", "010", "111", "010", "000"],
};

function blitGlyph(ctx, ch, x, y, px, color) {
  const glyph = FONT[ch] || FONT[ch.toUpperCase()] || FONT["•"];
  ctx.fillStyle = color;
  for (let gy = 0; gy < 5; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      if (glyph[gy][gx] === "1") ctx.fillRect(x + gx * px, y + gy * px, px, px);
    }
  }
}

const HEART_MAP = [
  " 11 11 ",
  "1111111",
  "1111111",
  " 11111 ",
  "  111  ",
  "   1   ",
];

export function drawPixelHeart(ctx, heart, unit) {
  const map = HEART_MAP;
  const rows = map.length;
  const cols = map[0].length;
  const px = Math.max(3, Math.min(6, Math.round((unit || 4) * (0.72 + (heart.size || 1) * 0.42))));
  const x = Math.round(heart.x);
  const y = Math.round(heart.y);
  let a = Math.max(0, Math.min(1, heart.life));
  if (a > 0.84) a = (1 - a) / 0.16;
  else if (a < 0.34) a = a / 0.34;
  else a = 1;
  const t = heart.tint || 0;
  const fill = t > 0.62 ? "#ff9eb4" : t > 0.32 ? "#ff5d7c" : "#ff3a5e";
  const outline = t > 0.62 ? "#a3445c" : "#6e142e";
  const shine = "#fff3f6";
  const shade = t > 0.62 ? "#e56d88" : "#d42650";
  const solid = (c, r) => r >= 0 && r < rows && c >= 0 && c < cols && map[r][c] === "1";

  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = outline;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!solid(c, r)) continue;
      for (const [dc, dr] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        if (!solid(c + dc, r + dr)) ctx.fillRect(x + (c + dc) * px, y + (r + dr) * px, px, px);
      }
    }
  }
  ctx.fillStyle = fill;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (solid(c, r)) ctx.fillRect(x + c * px, y + r * px, px, px);
    }
  }
  ctx.fillStyle = shade;
  ctx.fillRect(x + px * 4, y + px * 2, px, px);
  ctx.fillRect(x + px * 3, y + px * 3, px, px);
  ctx.fillStyle = shine;
  ctx.fillRect(x + px, y + px, px, px);
  ctx.restore();
}

export function drawKeycap(ctx, cap, unit) {
  const label = String(cap.label || "•");
  const chars = [...label].slice(0, 3);
  const px = Math.max(1, Math.round(unit));
  const pad = px;
  const gw = chars.length * 4 * px - px;
  const gh = 5 * px;
  const w = gw + pad * 2 + px;
  const h = gh + pad * 2 + px;
  const x = Math.round(cap.x);
  const y = Math.round(cap.y);
  const a = Math.max(0, Math.min(1, cap.life));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "#2a2118";
  ctx.fillRect(x + px, y + px, w, h);
  ctx.fillStyle = "#d7c7a4";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#efe6d2";
  ctx.fillRect(x + px, y + px, w - px * 2, h - px * 3);
  let ox = x + pad;
  const oy = y + pad;
  for (const ch of chars) {
    blitGlyph(ctx, ch, ox, oy, px, "#1a1a1a");
    ox += 4 * px;
  }
  ctx.restore();
}

export function applyLook(imageData, highlights, pupilX, pupilY, blink, sleep) {
  if (!highlights?.length) return imageData;
  const { width: w, height: h, data } = imageData;
  const copy = new Uint8ClampedArray(data);
  for (const p of highlights) {
    const i = (p.y * w + p.x) * 4;
    copy[i] = 12;
    copy[i + 1] = 12;
    copy[i + 2] = 12;
    copy[i + 3] = 255;
  }
  if (!sleep && blink < 0.6) {
    const dx = Math.round(pupilX);
    const dy = Math.round(pupilY);
    for (const p of highlights) {
      const x = Math.max(0, Math.min(w - 1, p.x + dx));
      const y = Math.max(0, Math.min(h - 1, p.y + dy));
      const i = (y * w + x) * 4;
      copy[i] = copy[i + 1] = copy[i + 2] = 245;
      copy[i + 3] = 255;
    }
  }
  if (blink > 0.45 || sleep) {
    const ys = highlights.map((p) => p.y);
    const xs = highlights.map((p) => p.x);
    const midY = Math.round(ys.reduce((a, b) => a + b, 0) / ys.length);
    const minX = Math.min(...xs) - 2;
    const maxX = Math.max(...xs) + 2;
    for (let x = minX; x <= maxX; x++) {
      for (let y = midY - 1; y <= midY + 1; y++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4;
        if (copy[i + 3] < 80) continue;
        copy[i] = 18;
        copy[i + 1] = 18;
        copy[i + 2] = 18;
      }
    }
  }
  const out = new ImageData(copy, w, h);
  return out;
}
