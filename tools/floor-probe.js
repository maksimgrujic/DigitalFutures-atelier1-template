// Find where the drawn floor starts in a backdrop image, as a fraction of
// height, so the physics floor can be aligned to the art at any stage size.
// Usage: node tools/floor-probe.js backdrop.png
const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync(process.argv[2]);
const W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
const colorType = buf[25], bitDepth = buf[24], interlace = buf[28];
if (bitDepth !== 8 || interlace !== 0) { console.error('unsupported PNG'); process.exit(1); }

let off = 8, idat = [], palette = null, trns = null;
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const tag = buf.toString('ascii', off + 4, off + 8);
  const data = buf.subarray(off + 8, off + 8 + len);
  if (tag === 'IDAT') idat.push(data);
  else if (tag === 'PLTE') palette = Buffer.from(data);
  else if (tag === 'tRNS') trns = Buffer.from(data);
  off += 12 + len;
}
const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
const stride = W * CH;
const raw = zlib.inflateSync(Buffer.concat(idat));
const px = Buffer.alloc(H * stride);
let prev = Buffer.alloc(stride);
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
for (let y = 0; y < H; y++) {
  const ft = raw[y * (stride + 1)];
  const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  const cur = Buffer.alloc(stride);
  for (let i = 0; i < stride; i++) {
    const a = i >= CH ? cur[i - CH] : 0, b = prev[i], c = i >= CH ? prev[i - CH] : 0;
    let v = line[i];
    if (ft === 1) v += a; else if (ft === 2) v += b;
    else if (ft === 3) v += (a + b) >> 1; else if (ft === 4) v += paeth(a, b, c);
    cur[i] = v & 255;
  }
  cur.copy(px, y * stride);
  prev = cur;
}
const at = (x, y, ch) => {
  const o = y * stride + x * CH;
  if (colorType === 3) { const k = px[o]; return palette[k * 3 + ch]; }
  if (colorType === 0 || colorType === 4) return px[o];
  return px[o + ch];
};

console.log(`${W}x${H}`);

// Sample several columns and find the first row where green dominates over red
// (the wall is purple: r > g; the floor is green: g > r).
const cols = [Math.round(W * 0.15), Math.round(W * 0.5), Math.round(W * 0.85)];
const floorRows = [];
for (const x of cols) {
  let row = -1;
  for (let y = 0; y < H; y++) {
    const r = at(x, y, 0), g = at(x, y, 1), b = at(x, y, 2);
    if (g > r + 10 && g > b + 10) { row = y; break; }
  }
  floorRows.push(row);
  console.log(`  col x=${x}: first green row y=${row}  (${row >= 0 ? ((row / H) * 100).toFixed(1) + '% down' : 'none'})`);
}

const valid = floorRows.filter((r) => r >= 0);
if (valid.length) {
  const y = Math.max(...valid); // lowest = most conservative (art-dependent columns)
  const mid = valid[Math.floor(valid.length / 2)];
  console.log(`\nfloor line (max col): y=${y}  -> fraction ${(y / H).toFixed(4)} of height`);
  console.log(`floor line (median):  y=${mid} -> fraction ${(mid / H).toFixed(4)} of height`);
  console.log(`\nsuggest FLOOR_FRACTION = ${(mid / H).toFixed(3)}   (1 - that = ${(1 - mid / H).toFixed(3)} up from bottom)`);
}

// Also report the darkest / bottom strip so we can see if there's a base plinth.
const bottom = Math.round(H * 0.95);
console.log(`\nrow ${bottom} samples:`,
  cols.map((x) => `${at(x, bottom, 0)},${at(x, bottom, 1)},${at(x, bottom, 2)}`).join('  |  '));
