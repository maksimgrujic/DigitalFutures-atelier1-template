// Dump a vertical colour profile of a backdrop so the floor line can be read
// off the real pixel values instead of guessed at with a threshold.
// Usage: node tools/color-profile.js backdrop.png [colFraction]
const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync(process.argv[2]);
const colFrac = Number(process.argv[3] || 0.5);
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

const x = Math.round(W * colFrac);
console.log(`column x=${x} of ${W}, rows 0..${H - 1}\n`);

// Print a run-length summary: collapse consecutive rows of similar colour.
const key = (y) => `${at(x, y, 0)},${at(x, y, 1)},${at(x, y, 2)}`;
let start = 0, cur = key(0);
for (let y = 1; y <= H; y++) {
  const k = y < H ? key(y) : null;
  if (k !== cur) {
    const len = y - start;
    if (len >= 2) console.log(`  y=${String(start).padStart(3)}..${String(y - 1).padStart(3)} (${String(len).padStart(2)}px)  rgb(${cur})`);
    start = y;
    cur = k;
  }
}
console.log('\nrow-by-row around the suspected floor (top 60% onward):');
for (let y = Math.round(H * 0.6); y < H; y++) {
  const r = at(x, y, 0), g = at(x, y, 1), b = at(x, y, 2);
  const mark = g > r && g > b ? ' <-- green-dominant' : '';
  console.log(`  y=${String(y).padStart(3)} (${((y / H) * 100).toFixed(1)}%)  rgb(${r},${g},${b})${mark}`);
}
