// Decode a QR PNG and lay it out small on an A4 page as a print-ready PDF.
// Usage: node tools/make-qr-pdf.js qr.png out.pdf [size-mm]
const fs = require('fs');
const zlib = require('zlib');

const inPath = process.argv[2];
const outPath = process.argv[3];
const sizeMm = Number(process.argv[4] || 25);

if (!inPath || !outPath) {
  console.error('usage: node tools/make-qr-pdf.js qr.png out.pdf [size-mm]');
  process.exit(1);
}
if (!outPath.toLowerCase().endsWith('.pdf')) {
  console.error('refusing: output must be a .pdf');
  process.exit(1);
}
if (outPath.toLowerCase() === inPath.toLowerCase()) {
  console.error('refusing to overwrite the input file');
  process.exit(1);
}

// ---------------- decode PNG ----------------
const buf = fs.readFileSync(inPath);
if (buf.readUInt32BE(0) !== 0x89504e47) {
  console.error('not a PNG');
  process.exit(1);
}
const W = buf.readUInt32BE(16);
const H = buf.readUInt32BE(20);
const bitDepth = buf[24];
const colorType = buf[25];
const interlace = buf[28];

if (bitDepth !== 8) { console.error(`unsupported bit depth ${bitDepth} (need 8)`); process.exit(1); }
if (interlace !== 0) { console.error('interlaced PNG not supported'); process.exit(1); }

let off = 8;
let idat = [], palette = null, trns = null;
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
const bpp = CH; // 8-bit per channel
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

// ---------------- flatten to RGB on white ----------------
const rgb = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  let r, g, b, a = 255;
  const o = i * CH;
  if (colorType === 3) {
    const idx = px[o];
    r = palette[idx * 3]; g = palette[idx * 3 + 1]; b = palette[idx * 3 + 2];
    if (trns && idx < trns.length) a = trns[idx];
  } else if (colorType === 0) {
    r = g = b = px[o];
  } else if (colorType === 4) {
    r = g = b = px[o]; a = px[o + 1];
  } else if (colorType === 2) {
    r = px[o]; g = px[o + 1]; b = px[o + 2];
  } else {
    r = px[o]; g = px[o + 1]; b = px[o + 2]; a = px[o + 3];
  }
  if (a === 255) {
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
  } else {
    const k = a / 255;
    rgb[i * 3] = Math.round(r * k + 255 * (1 - k));
    rgb[i * 3 + 1] = Math.round(g * k + 255 * (1 - k));
    rgb[i * 3 + 2] = Math.round(b * k + 255 * (1 - k));
  }
}

// ---------------- A4 layout ----------------
const PAGE_W = 595.276;      // A4 in points
const PAGE_H = 841.89;
const s = (sizeMm / 25.4) * 72;       // QR side in points
const x = (PAGE_W - s) / 2;
const y = (PAGE_H - s) / 2;

const imgData = zlib.deflateSync(rgb);
const content = Buffer.from(
  `q\n${s.toFixed(3)} 0 0 ${s.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/Im0 Do\nQ\n`,
  'latin1'
);

// ---------------- assemble PDF ----------------
const parts = [];
let cursor = 0;
const put = (b) => { parts.push(b); cursor += b.length; return cursor; };

put(Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1'));

const bodies = [];
bodies[1] = Buffer.from('<< /Type /Catalog /Pages 2 0 R >>\n', 'latin1');
bodies[2] = Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n', 'latin1');
bodies[3] = Buffer.from(
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
  `/Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> ` +
  `/Contents 5 0 R >>\n`, 'latin1');
bodies[4] = Buffer.concat([
  Buffer.from(
    `<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
    `/Length ${imgData.length} >>\nstream\n`, 'latin1'),
  imgData,
  Buffer.from('\nendstream\n', 'latin1')
]);
bodies[5] = Buffer.concat([
  Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'latin1'),
  content,
  Buffer.from('endstream\n', 'latin1')
]);

const offsets = [0];
for (let n = 1; n <= 5; n++) {
  offsets[n] = cursor;
  put(Buffer.from(`${n} 0 obj\n`, 'latin1'));
  put(bodies[n]);
  put(Buffer.from('endobj\n', 'latin1'));
}

const xrefStart = cursor;
let xref = `xref\n0 6\n0000000000 65535 f \n`;
for (let n = 1; n <= 5; n++) {
  xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
}
xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
put(Buffer.from(xref, 'latin1'));

const pdf = Buffer.concat(parts);
fs.writeFileSync(outPath, pdf);

// ---------------- verify the xref actually points at "xref" ----------------
const txt = pdf.toString('latin1');
const m = /startxref\n(\d+)\n%%EOF/.exec(txt);
const ok = m && txt.slice(Number(m[1]), Number(m[1]) + 4) === 'xref';
console.log(`wrote ${outPath}  ${pdf.length} bytes  |  source ${W}x${H}px  QR ${sizeMm}mm on A4  |  xref ${ok ? 'OK' : 'BROKEN'}`);
if (!ok) process.exit(1);
