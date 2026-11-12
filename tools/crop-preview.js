// Decode a PNG and re-encode a crop of it, so we can eyeball the sprite-sheet
// slice before shipping it.  Usage: node tools/crop-preview.js sheet.png out.png sx sy sw sh
const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync(process.argv[2]);
const w = buf.readUInt32BE(16);
const h = buf.readUInt32BE(20);
const type = buf[25];

let off = 8, idat = [];
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const tag = buf.toString('ascii', off + 4, off + 8);
  if (tag === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
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

const at = (x, y, ch) => {
  const base = y * stride + x * bpp;
  if (type === 6) return px[base + ch];
  if (type === 4) return ch === 3 ? px[base + 1] : px[base];
  if (type === 2) return px[base + ch];
  return px[base];
};

// ---- crop three frames side by side ----
// argv: sheet out sx sy sw sh [cell] [scale]
const sheetPath = process.argv[2];
const out = process.argv[3];
const SX = Number(process.argv[4]), SY = Number(process.argv[5]);
const SW = Number(process.argv[6]), SH = Number(process.argv[7]);
const CELL = Number(process.argv[8] || 48);
const SCALE = Number(process.argv[9] || 1);
if (!out || out.toLowerCase() === sheetPath.toLowerCase()) {
  console.error('refusing to write over the input file');
  process.exit(1);
}
const gap = 4 * SCALE;
const OW = SW * SCALE * 3 + gap * 2;
const OH = SH * SCALE;
const outPx = Buffer.alloc(OW * OH * 4);

for (let i = 0; i < 3; i++) {
  const ox = i * (SW * SCALE + gap);
  for (let y = 0; y < OH; y++) {
    for (let x = 0; x < SW * SCALE; x++) {
      const srcX = SX + i * CELL + Math.floor(x / SCALE);
      const srcY = SY + Math.floor(y / SCALE);
      const d = y * OW + (ox + x);
      outPx[d * 4] = at(srcX, srcY, 0);
      outPx[d * 4 + 1] = at(srcX, srcY, 1);
      outPx[d * 4 + 2] = at(srcX, srcY, 2);
      outPx[d * 4 + 3] = type === 2 || type === 3 || type === 0 ? 255 : at(srcX, srcY, 3);
    }
  }
}

// draw the slices onto an opaque backdrop so transparency is visible
const bg = [40, 120, 210];
for (let i = 0; i < outPx.length; i += 4) {
  const a = outPx[i + 3] / 255;
  outPx[i] = Math.round(outPx[i] * a + bg[0] * (1 - a));
  outPx[i + 1] = Math.round(outPx[i + 1] * a + bg[1] * (1 - a));
  outPx[i + 2] = Math.round(outPx[i + 2] * a + bg[2] * (1 - a));
  outPx[i + 3] = 255;
}

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (b) => {
  let c = -1;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (tag, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(tag, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(OW, 0);
ihdr.writeUInt32BE(OH, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA

const scan = Buffer.alloc(OH * (OW * 4 + 1));
for (let y = 0; y < OH; y++) {
  scan[y * (OW * 4 + 1)] = 0;
  outPx.copy(scan, y * (OW * 4 + 1) + 1, y * OW * 4, (y + 1) * OW * 4);
}

fs.writeFileSync(out, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(scan)),
  chunk('IEND', Buffer.alloc(0))
]));
console.log(`wrote ${out} (${OW}x${OH}) from frames at x=${SX}, y=${SY}, ${SW}x${SH}, cell ${CELL}`);
