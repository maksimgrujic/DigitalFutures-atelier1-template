// Find the true top edge of the drawn floor across every column, so the
// physics floor can be aligned to the art.  Usage: node tools/floor-line.js backdrop.png
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

// The purple wall is a single flat colour; find it from the top-left corner.
const wallR = at(0, 0, 0), wallG = at(0, 0, 1), wallB = at(0, 0, 2);
console.log(`wall colour rgb(${wallR},${wallG},${wallB})`);

const isWall = (x, y) =>
  Math.abs(at(x, y, 0) - wallR) <= 6 &&
  Math.abs(at(x, y, 1) - wallG) <= 6 &&
  Math.abs(at(x, y, 2) - wallB) <= 6;

const tops = [];
for (let x = 0; x < W; x++) {
  let y = 0;
  while (y < H && isWall(x, y)) y++;
  tops.push(y);
}
tops.sort((a, b) => a - b);
const minTop = tops[0];
const maxTop = tops[tops.length - 1];
const medianTop = tops[Math.floor(tops.length / 2)];
console.log(`floor top edge per column: min y=${minTop}  median y=${medianTop}  max y=${maxTop}`);
console.log(`  as fraction of ${H}px:  min ${(minTop / H).toFixed(4)}  median ${(medianTop / H).toFixed(4)}  max ${(maxTop / H).toFixed(4)}`);

// Histogram of column counts at each distinct top row.
const counts = {};
for (const t of tops) counts[t] = (counts[t] || 0) + 1;
console.log('\ncolumns per top-row:');
for (const k of Object.keys(counts).sort((a, b) => a - b)) {
  console.log(`  y=${k} (${((k / H) * 100).toFixed(1)}% down): ${counts[k]} columns`);
}

const chosen = maxTop;
console.log(`\nUse the MAX (lowest floor top) so no art pokes above the physics floor:`);
console.log(`  FLOOR_TOP = ${chosen} / ${H} = ${(chosen / H).toFixed(4)}`);
console.log(`  -> raise floor by ${H - chosen}px = ${(((H - chosen) / H) * 100).toFixed(1)}% of stage height`);
