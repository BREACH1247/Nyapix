const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const PAL = {
  ".": [0, 0, 0, 0],
  "#": [18, 18, 18, 255],
  e: [139, 90, 42, 255],
  f: [196, 140, 72, 255],
  w: [255, 255, 255, 255],
  k: [17, 17, 17, 255],
  h: [255, 255, 255, 255],
  r: [220, 48, 48, 255],
};

const ROWS = [
  "....######.........######....",
  "...#eeeeee#.......#eeeeee#...",
  "..#eeeeeeee#.....#eeeeeeee#..",
  "..#eeeeeeee#.....#eeeeeeee#..",
  "..#eeeeee###.....###eeeeee#..",
  "..###eee#fffffffffff#eee###..",
  "....#ee#fffffffffffff#ee#....",
  ".....##fffffffffffffff##.....",
  "...#ffff#kkkk#w#kkkk#ffff#...",
  "...#ffff#kkkh#w#kkkh#ffff#...",
  "...#ffff#kkkk#w#kkkk#ffff#...",
  "...#ffff#kkkk#w#kkkk#ffff#...",
  "...#fffffwwwwwwwwwwwfffff#...",
  "....#ffffwww#rrr#wwwffff#....",
  ".....#ffffwwwwwwwwwffff#.....",
  "......#fffffffffffffff#......",
  ".....#www#fffffffff#www#.....",
  "....#wwwww#fffffff#wwwww#....",
  "...#ffffff#fffffff#ffffff#...",
  "..#e#ffff#fffffffff#ffff#....",
  ".#ew#fff#fffffffffff#fff#....",
  ".#ew##ww#fffffffffff#ww#.....",
  ".#e#.#ww#fffffffffff#ww#.....",
  ".##..#ww#fffffffffff#ww#.....",
  ".....#ww#fffffffffff#ww#.....",
  "......##.#fffffffff#.##......",
  ".......################......",
];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

const w = ROWS[0].length;
const h = ROWS.length;
const pixels = Buffer.alloc(w * h * 4);
for (let y = 0; y < h; y++) {
  if (ROWS[y].length !== w) throw new Error(`row ${y} is ${ROWS[y].length}, want ${w}`);
  for (let x = 0; x < w; x++) {
    const c = PAL[ROWS[y][x]];
    if (!c) throw new Error(`bad pixel ${ROWS[y][x]} at ${x},${y}`);
    const i = (y * w + x) * 4;
    pixels[i] = c[0];
    pixels[i + 1] = c[1];
    pixels[i + 2] = c[2];
    pixels[i + 3] = c[3];
  }
}

const raw = [];
for (let y = 0; y < h; y++) {
  raw.push(0);
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    raw.push(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]);
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(w, 0);
ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const out = path.join(__dirname, "..", "src", "cat", "sprite-dog.png");
fs.writeFileSync(
  out,
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.from(raw))),
    chunk("IEND", Buffer.alloc(0)),
  ])
);
console.log(`wrote ${w}x${h} ${out}`);
