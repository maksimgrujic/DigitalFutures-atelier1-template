// Quick sprite-sheet probe: size, colour type, transparency, frame gutters.
const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync(process.argv[2]);
const w = buf.readUInt32BE(16);
const h = buf.readUInt32BE(20);
const depth = buf[24];
const type = buf[25];
console.log(`${w}x${h} depth=${depth} colortype=${type} (6=RGBA,2=RGB,3=indexed,4=gray+A)`);

// collect IDAT
let off = 8, idat = [];
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const tag = buf.toString('ascii', off + 4, off + 8);
  if (tag === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
  if (tag === 'PLTE') console.log('has PLTE palette');
  off += 12 + len;
}
const raw = zlib.inflateSync(Buffer.concat(idat));

const bpp = type === 6 ? 4 : type === 2 ? 3 : type === 4 ? 2 : 1;
const stride = w * bpp;
const px = Buffer.alloc(h * stride);
let prev = Buffer.alloc(stride);

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

for (let y = 0; y < h; y++) {
  const ft = raw[y * (stride + 1)];
  const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  const cur = Buffer.alloc(stride);
  for (let i = 0; i < stride; i++) {
    const a = i >= bpp ? cur[i - bpp] : 0;
    const b = prev[i];
    const c = i >= bpp ? prev[i - bpp] : 0;
    let v = line[i];
    if (ft === 1) v += a;
    else if (ft === 2) v += b;
    else if (ft === 3) v += (a + b) >> 1;
    else if (ft === 4) v += paeth(a, b, c);
    cur[i] = v & 255;
  }
  cur.copy(px, y * stride);
  prev = cur;
}

const alphaAt = (x, y) => (type === 6 ? px[y * stride + x * 4 + 3] : type === 4 ? px[y * stride + x * 2 + 1] : 255);
console.log('corner alpha TL/TR/BL/BR:',
  alphaAt(0, 0), alphaAt(w - 1, 0), alphaAt(0, h - 1), alphaAt(w - 1, h - 1));

// opaque-pixel count per column, to spot gutters between frames
const cols = [];
for (let x = 0; x < w; x++) {
  let n = 0;
  for (let y = 0; y < h; y++) if (alphaAt(x, y) > 8) n++;
  cols.push(n);
}
const runs = [];
let start = null;
for (let x = 0; x < w; x++) {
  if (cols[x] > 0 && start === null) start = x;
  if ((cols[x] === 0 || x === w - 1) && start !== null) {
    runs.push([start, cols[x] === 0 ? x - 1 : x]);
    start = null;
  }
}
console.log('content column runs:', JSON.stringify(runs));

// same for rows
const rows = [];
for (let y = 0; y < h; y++) {
  let n = 0;
  for (let x = 0; x < w; x++) if (alphaAt(x, y) > 8) n++;
  rows.push(n);
}
console.log('first/last opaque row:', rows.findIndex((n) => n > 0), rows.map((n, i) => [n, i]).filter(([n]) => n > 0).pop());
