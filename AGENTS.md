# Project conventions

## When the user asks for an update
Any change to this sketch gets the full delivery pipeline automatically — do not wait to be asked:

1. Edit the file(s), run `node --check sketch.js` if `sketch.js` changed.
   - Bump `BUILD_TAG` in `sketch.js` **and** the `?v=` query on the `sketch.js`
     `<script>` in `index.html` (same value) — that busts the 10-min Pages cache
     and shows the user which build their phone is running.
2. Commit and push to `main` (repo style: short imperative sentence).
3. Wait for the GitHub Pages deploy to finish and verify it:
   `gh run list --repo maksimgrujic/DigitalFutures-atelier1-template --limit 1 --json status,conclusion`
   then confirm the live `sketch.js` on
   `https://maksimgrujic.github.io/DigitalFutures-atelier1-template/sketch.js` contains the new code.
4. **Always generate and open the QR code** so the user can test on their phone:
   - root cat program → `catqrplaytest2version0.png`:
     `& "C:\Program Files\nodejs\npx.cmd" --yes qrcode -o "C:\Users\maksi\AppData\Local\Temp\opencode\catqrplaytest2version0.png" -w 700 "https://maksimgrujic.github.io/DigitalFutures-atelier1-template/"`
   - `playtest2/` owl program → `owlplaytest2version0.png`:
     `& "C:\Program Files\nodejs\npx.cmd" --yes qrcode -o "C:\Users\maksi\AppData\Local\Temp\opencode\owlplaytest2version0.png" -w 700 "https://maksimgrujic.github.io/DigitalFutures-atelier1-template/playtest2/"`
   - `catv1/` cat v1 → `catqrplaytest2version1.png`:
     `& "C:\Program Files\nodejs\npx.cmd" --yes qrcode -o "C:\Users\maksi\AppData\Local\Temp\opencode\catqrplaytest2version1.png" -w 700 "https://maksimgrujic.github.io/DigitalFutures-atelier1-template/catv1/"`
   - `owlv1/` owl v1 → `owlplaytest2version1.png`:
     `& "C:\Program Files\nodejs\npx.cmd" --yes qrcode -o "C:\Users\maksi\AppData\Local\Temp\opencode\owlplaytest2version1.png" -w 700 "https://maksimgrujic.github.io/DigitalFutures-atelier1-template/owlv1/"`
   followed by `Start-Process` on that PNG. If the write fails with `UNKNOWN: open`,
   a Photos window is holding the old PNG — close that window, then regenerate.
   (Use `npx.cmd`, not `npx` — PowerShell execution policy blocks `npx.ps1`.)
5. Tell the user to reload/close the old tab on the phone (Pages caches ~10 min).

## playtest2 (library owl)
- Lives **entirely** in `playtest2/` (own `index.html`, `sketch.js`, and asset
  copies). Never edit root `sketch.js`/`index.html` for it, or vice versa — the
  two programs must stay independent.
- Same pipeline: `node --check playtest2/sketch.js`, bump `BUILD_TAG` in
  `playtest2/sketch.js` **and** `?v=` in `playtest2/index.html` (same value),
  push, then verify **both**: root still serves its last build tag *and*
  `playtest2/sketch.js` serves the new one.
- Its QR is `owlplaytest2version0.png` → `…/playtest2/` (see step 4).
- Separate persistence: the owl stores direction flips under `owlTiltDir`,
  the cat under `catTiltDir` — they must never share a key.

## Playtest versions (v0 vs v1)
Four independent programs, compared side by side at playtests:

| Program | Folder | URL path | QR file | localStorage key |
|---|---|---|---|---|
| cat v0 | repo root | `/` | `catqrplaytest2version0.png` | `catTiltDir` |
| owl v0 | `playtest2/` | `/playtest2/` | `owlplaytest2version0.png` | `owlTiltDir` |
| cat v1 | `catv1/` | `/catv1/` | `catqrplaytest2version1.png` | `catV1TiltDir` |
| owl v1 | `owlv1/` | `/owlv1/` | `owlplaytest2version1.png` | `owlV1TiltDir` |

- **v0 is frozen**: when the user asks for a v1 change, never touch the root or
  `playtest2/` files. Each v1 is a full copy (own `index.html`, `sketch.js`,
  assets) of its v0, differing only in the knobs named in its header comment.
- cat v1: `ACCELERATION` 0.20 (v0 0.16) — ~25% faster slide.
  owl v1: `SHAKE_ACCEL` 15 (v0 5) — needs a much harder shake to climb.
- Same pipeline per folder: `node --check <folder>/sketch.js`, bump that
  folder's `BUILD_TAG` and `?v=` together, then verify **all four** live
  build tags so an edit to one can't silently change another.

## Notes
- `index.html` loads p5.js **2.x** and p5-phone — write p5 2 code: `async setup()` + `await loadImage()`,
  no `preload()`, `mousePressed` (not `touchStarted`).
- p5 2 defaults `angleMode` to **RADIANS** — convert sensor angles with `degrees()`.
- Physics feel constants live in the tuning block at the top of `sketch.js`.
- Local preview: node static server on port 8000 serving the repo root.
