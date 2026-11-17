// Definitive check: decode the QR pixels back to text.
// Usage: node tools/qr-decode.js image.png
const fs = require('fs');
const zlib = require('zlib');

// --- decode PNG to RGBA (colour types 0/2/3/4/6, 8-bit, non-interlaced) ---
const buf = fs.readFileSync(process.argv[2]);
const W = buf.readUInt32BE(16), H = buf.readUInt32BE(20);
const bitDepth = buf[24], colorType = buf[25], interlace = buf[28];
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

const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const o = i * CH;
  let r, g, b, a = 255;
  if (colorType === 3) { const k = px[o]; r = palette[k * 3]; g = palette[k * 3 + 1]; b = palette[k * 3 + 2]; if (trns && k < trns.length) a = trns[k]; }
  else if (colorType === 0) { r = g = b = px[o]; }
  else if (colorType === 4) { r = g = b = px[o]; a = px[o + 1]; }
  else if (colorType === 2) { r = px[o]; g = px[o + 1]; b = px[o + 2]; }
  else { r = px[o]; g = px[o + 1]; b = px[o + 2]; a = px[o + 3]; }
  const k = a / 255;
  rgba[i * 4] = Math.round(r * k + 255 * (1 - k));
  rgba[i * 4 + 1] = Math.round(g * k + 255 * (1 - k));
  rgba[i * 4 + 2] = Math.round(b * k + 255 * (1 - k));
  rgba[i * 4 + 3] = 255;
}

const jsQR = require('jsqr');
const res = jsQR(new Uint8ClampedArray(rgba), W, H);
if (res && res.data) {
  console.log('DECODED: ' + res.data);
  console.log('version: ' + (res.version) + ' | size: ' + W + 'x' + H);
  process.exit(0);
}
console.error('DECODE FAILED — not a readable QR');
process.exit(1);
