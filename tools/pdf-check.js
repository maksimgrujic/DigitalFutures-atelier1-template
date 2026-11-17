// Read back a PDF produced by make-qr-pdf.js and check its structure:
// objects present, xref offsets accurate, image stream re-inflates to the
// expected pixel dimensions.  Usage: node tools/pdf-check.js file.pdf
const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync(process.argv[2]);
const txt = buf.toString('latin1');
let fail = 0;
const say = (ok, label) => { console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}`); if (!ok) fail++; };

say(txt.startsWith('%PDF-1.'), 'PDF header');
say(/%%EOF\s*$/.test(txt), 'EOF marker');

// ---- xref table accuracy ----
const sx = /startxref\n(\d+)\n%%EOF/.exec(txt);
if (!sx) { say(false, 'startxref present'); }
else {
  const at = Number(sx[1]);
  say(txt.slice(at, at + 4) === 'xref', `startxref -> "xref" (offset ${at})`);

  const body = txt.slice(at);
  const lines = body.split('\n');
  const count = Number((lines[1] || '').trim().split(' ')[1]);
  say(count === 6, `xref declares ${count} entries (expect 6)`);

  for (let i = 1; i < count; i++) {
    const entry = lines[2 + i];
    const off = Number(entry.slice(0, 10));
    const tag = `${i} 0 obj`;
    say(txt.slice(off, off + tag.length) === tag, `xref[${i}] offset ${off} -> "${tag}"`);
  }
}

// ---- objects ----
const wanted = {
  1: '/Type /Catalog', 2: '/Type /Pages', 3: '/Type /Page',
  4: '/Subtype /Image', 5: 'stream'
};
for (const [n, needle] of Object.entries(wanted)) {
  const re = new RegExp(`${n} 0 obj[\\s\\S]{0,400}?${needle.replace(/[/\\]/g, '\\$&')}`);
  say(re.test(txt), `object ${n} contains ${needle}`);
}

// ---- page geometry: A4 + centred square ----
const mb = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(txt);
say(mb && Math.abs(mb[1] - 595.276) < 0.01 && Math.abs(mb[2] - 841.89) < 0.01,
  `MediaBox is A4 (${mb ? mb[1] + ' x ' + mb[2] : 'missing'})`);

const cm = /q\n([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/.exec(txt);
if (cm) {
  const side = Number(cm[1]);
  const mm = (side / 72) * 25.4;
  const cx = Number(cm[3]) + side / 2;
  const cy = Number(cm[4]) + side / 2;
  say(Math.abs(cx - 595.276 / 2) < 0.01 && Math.abs(cy - 841.89 / 2) < 0.01,
    `QR centred on page (cx ${cx.toFixed(1)}, cy ${cy.toFixed(1)})`);
  say(mm > 5 && mm < 60, `QR size ${mm.toFixed(1)}mm — printable, scans`);
  say(/\/Im0 Do/.test(txt), 'image painted via /Im0 Do');
} else {
  say(false, 'cm transform found');
}

// ---- image stream round-trip ----
const im = /\/Width (\d+) \/Height (\d+)[\s\S]*?\/Length (\d+) >>\nstream\n/.exec(txt);
if (im) {
  const [, w, h, len] = im.map(Number);
  const start = im.index + im[0].length;
  const data = buf.subarray(start, start + len);
  try {
    const rgb = zlib.inflateSync(data);
    say(rgb.length === w * h * 3, `image inflates to ${w}x${h} RGB (${rgb.length} bytes, expect ${w * h * 3})`);

    // Re-sample the module grid: a QR must alternate light/dark at module scale.
    let dark = 0;
    for (let i = 0; i < w * h; i++) if (rgb[i * 3] < 128) dark++;
    const ratio = dark / (w * h);
    say(ratio > 0.3 && ratio < 0.65, `dark-pixel ratio ${(ratio * 100).toFixed(1)}% (QRs sit near 40-50%)`);

    // Finder-pattern probe: measure the module size from the actual 7-module
    // run on the top row instead of guessing the symbol version.
    const isDark = (x, y) => rgb[(y * w + x) * 3] < 128;
    let top = -1;
    for (let y = 0; y < h && top < 0; y++) {
      for (let x = 0; x < w; x++) {
        if (isDark(x, y)) { top = y; break; }
      }
    }
    let run = 0, firstX = -1;
    if (top >= 0) {
      let x = 0;
      while (x < w && !isDark(x, top)) x++;
      firstX = x;
      while (x < w && isDark(x, top)) { run++; x++; }
    }
    const m = run / 7; // finder pattern is exactly 7 modules wide
    say(top >= 0 && Number.isInteger(run) && run > 0 && m >= 1,
      `finder top row y=${top}, starts x=${firstX}, dark run=${run}px -> module ${m.toFixed(2)}px`);
    if (m >= 1) {
      // Sample module CENTRES: module size is non-integer (80/7), so landing on
      // an edge flips the reading. Origin is the finder pattern's top-left.
      const at = (mx, my) => isDark(
        Math.round(firstX + (mx + 0.5) * m),
        Math.round(top + (my + 0.5) * m)
      );
      // A valid finder: ring of dark, light inner border, dark 3x3 core.
      const ring = at(0, 0) && at(6, 0) && at(0, 6) && at(6, 6);
      const core = at(2, 2) && at(4, 4) && at(3, 3) && at(2, 4) && at(4, 2);
      const hollow = !at(1, 1) && !at(5, 1) && !at(1, 5) && !at(5, 5);
      const edge = !at(7, 0) && !at(0, 7); // separator is light
      say(ring && core && hollow && edge,
        `finder pattern ring/hollow/core/separator ${ring && core && hollow && edge ? 'correct' : 'WRONG'}` +
        ` (quiet ${Math.round(firstX / m)} modules, module ${m.toFixed(2)}px)`);
    }
  } catch (e) {
    say(false, `image stream inflates: ${e.message}`);
  }
} else {
  say(false, 'image dict found');
}

console.log(fail ? `\n${fail} CHECK(S) FAILED` : '\nall checks passed');
process.exit(fail ? 1 : 0);
