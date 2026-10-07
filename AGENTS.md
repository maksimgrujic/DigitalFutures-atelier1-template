# Project conventions

## When the user asks for an update
Any change to this sketch gets the full delivery pipeline automatically — do not wait to be asked:

1. Edit the file(s), run `node --check sketch.js` if `sketch.js` changed.
2. Commit and push to `main` (repo style: short imperative sentence).
3. Wait for the GitHub Pages deploy to finish and verify it:
   `gh run list --repo maksimgrujic/DigitalFutures-atelier1-template --limit 1 --json status,conclusion`
   then confirm the live `sketch.js` on
   `https://maksimgrujic.github.io/DigitalFutures-atelier1-template/sketch.js` contains the new code.
4. **Always generate and open the QR code** so the user can test on their phone:
   `& "C:\Program Files\nodejs\npx.cmd" --yes qrcode -o "C:\Users\maksi\AppData\Local\Temp\opencode\cat-qr.png" -w 700 "https://maksimgrujic.github.io/DigitalFutures-atelier1-template/"`
   followed by `Start-Process` on that PNG.
   (Use `npx.cmd`, not `npx` — PowerShell execution policy blocks `npx.ps1`.)
5. Tell the user to reload/close the old tab on the phone (Pages caches ~10 min).

## Notes
- `index.html` loads p5.js **2.x** and p5-phone — write p5 2 code: `async setup()` + `await loadImage()`,
  no `preload()`, `mousePressed` (not `touchStarted`).
- p5 2 defaults `angleMode` to **RADIANS** — convert sensor angles with `degrees()`.
- Physics feel constants live in the tuning block at the top of `sketch.js`.
- Local preview: node static server on port 8000 serving the repo root.
