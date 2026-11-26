// ======================================================================
//  TUNE THE FEEL HERE  —  library owl (playtest2)
//  A flying character: no floor contact, no gravity. The owl holds station
//  when the phone is level and flies toward whichever way you rotate it.
// ======================================================================
const TILT_AXIS = 'auto';        // 'auto' = measure across whichever phone axis is
                                 //       horizontal on screen, or force 'Y' / 'X'
const TILT_DIRECTION_Y = -1;     // horizontal push sign when the Y axis lies on screen
const TILT_DIRECTION_X = 1;      // horizontal push sign when the X axis lies on screen
const TILT_DIRECTION_V = 1;      // vertical push sign — if the owl climbs when the
                                 //       phone's top edge tips away, flip this to -1
const DIR_VERSION = 1;           // bump when the defaults above change, so stale
                                 //       saved flips from older builds are ignored
const TILT_SENSITIVITY = 1 / 26; // how hard each degree of tilt pushes
const TILT_DEADZONE = 4;         // degrees of tilt ignored — this is what lets the owl hover
const MAX_FORCE = 1.6;           // cap on push per frame, keeps the owl from teleporting
const ACCELERATION = 0.16;       // how fast push becomes speed (bigger = more instant)
const FRICTION = 0.96;           // air drag: bleeds speed so a level phone = a steady hover
const STOP_SPEED = 0.05;         // below this the owl snaps to a full stop
const WALL_BOUNCE = 0;           // 0 = rests against the boundary, 0.5 = soft bounce
const KEY_PUSH = 1;              // how hard the arrow keys push
const SPRITE_SIZE = 0.18;        // owl width as a fraction of the smaller stage side
const SPRITE_LEAN = 0.015;       // how much the owl banks while moving
const STAGE_ASPECT = 16 / 9;     // the play area is always this shape (landscape)
const FLOOR_FRACTION = 0.865;    // floor line as a fraction of stage height — the top of
                                 // the green band in the backdrop; the owl can descend
                                 // to it but never into it, and it anchors the shadow
const ANIM_FPS = 8;              // wing-flap loop speed — all 3 frames cycle constantly
const BUILD_TAG = '2026-11-25-p2-a'; // bumped on every deploy (matches index.html ?v=)
// ======================================================================

const SHEET_SPRITE = 'owllibrarysprite.png';
// One strip of three 48px cells. Every frame's artwork sits inside the same
// crop box within its cell (x 4..43, y 16..49), so one rect pulls all three.
const SHEET_CELL_W = 48;
const SHEET_FRAME = { x: 4, y: 16, w: 40, h: 34 };
const BACKDROP_SPRITE = 'libraryroombackdropv0.png';

let backdrop = null;
let frames = [];
let owl = null;

let baseX = null;
let baseY = null;
let gotData = false;
let rxDeg = 0;
let ryDeg = 0;
// One direction setting per measured axis, for the HORIZONTAL push only. Stored
// under its own key so the owl's flips can never touch the cat's, and a saved
// flip is only honoured at the current DIR_VERSION.
let tiltDirs = { Y: TILT_DIRECTION_Y, X: TILT_DIRECTION_X };

function loadTiltDirs() {
  try {
    const s = JSON.parse(localStorage.getItem('owlTiltDir'));
    if (s && s.v === DIR_VERSION) {
      if (s.Y === 1 || s.Y === -1) tiltDirs.Y = s.Y;
      if (s.X === 1 || s.X === -1) tiltDirs.X = s.X;
    }
  } catch (e) {}
}

function flipTiltDir() {
  const axis = axisInUse();
  tiltDirs[axis] = -tiltDirs[axis];
  try {
    localStorage.setItem(
      'owlTiltDir',
      JSON.stringify({ v: DIR_VERSION, Y: tiltDirs.Y, X: tiltDirs.X })
    );
  } catch (e) {}
}

function tiltDir() {
  return tiltDirs[axisInUse()];
}

loadTiltDirs();

async function setup() {
  lockLandscape();
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noSmooth();
  lockGestures();
  // Consent overlay: shows the sensor request once, disappears on tap.
  enableSensorTap('Tap to enable motion sensors');
  if (window.isDesktop) showDesktopQr({ label: '' });

  const sheet = await loadSprite(SHEET_SPRITE);
  frames = [sheetFrame(sheet, 0), sheetFrame(sheet, 1), sheetFrame(sheet, 2)];
  backdrop = await loadSprite(BACKDROP_SPRITE);
  makeOwl();
}

// Landscape lock. orientation.lock() only sticks while fullscreen, and Chrome
// only allows fullscreen from a user gesture — so we try on load, and again
// after the permission tap and on any tap made while still in portrait.
async function lockLandscape() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
    }
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape');
    }
  } catch (e) {}
}

async function loadSprite(name) {
  try {
    return await loadImage(encodeURI(name));
  } catch (e) {
    return null;
  }
}

// Slice frame i (0-based) out of the sprite sheet as its own image.
function sheetFrame(sheet, i) {
  if (!sheet) return null;
  const f = SHEET_FRAME;
  return sheet.get(f.x + i * SHEET_CELL_W, f.y, f.w, f.h);
}

function stageRect() {
  let w = width;
  let h = width / STAGE_ASPECT;
  if (h > height) {
    h = height;
    w = height * STAGE_ASPECT;
  }
  return { x: (width - w) / 2, y: (height - h) / 2, w: w, h: h };
}

// The floor line, in canvas px: the top edge of the green band drawn in the
// backdrop. The owl stops above it (never flies into the floor) and its shadow
// is drawn on it — one helper so clamp and shadow can never drift apart.
function floorY(s) {
  return s.y + s.h * FLOOR_FRACTION;
}

function makeOwl() {
  const s = stageRect();
  const size = min(s.w, s.h) * SPRITE_SIZE;
  const aspect = SHEET_FRAME.h / SHEET_FRAME.w; // 34 / 40 — wider than tall
  owl = {
    x: s.x + s.w / 2,
    y: s.y + s.h * 0.45, // start mid-air, the owl never spawns on the floor
    vx: 0,
    vy: 0,
    w: size,
    h: size * aspect,
    dir: 1
  };
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  const s = stageRect();
  owl.w = min(s.w, s.h) * SPRITE_SIZE;
  owl.h = owl.w * (SHEET_FRAME.h / SHEET_FRAME.w);
  owl.x = constrain(owl.x, s.x + owl.w / 2, s.x + s.w - owl.w / 2);
  owl.y = constrain(owl.y, s.y + owl.h / 2, floorY(s) - owl.h / 2);
  if (gotData) {
    baseX = degrees(rotationX);
    baseY = degrees(rotationY);
  }
}

function userSetupComplete() {
  gotData = false;
  baseX = null;
  baseY = null;
  lockLandscape();
}

function draw() {
  background(232, 15, 8);

  const s = stageRect();
  noStroke();
  fill(44, 8, 97);
  rect(s.x, s.y, s.w, s.h);
  if (backdrop) image(backdrop, s.x, s.y, s.w, s.h);

  rxDeg = degrees(rotationX);
  ryDeg = degrees(rotationY);
  trackSensorData();

  const t = readInput();
  owl.vx = (owl.vx + t.x * ACCELERATION) * FRICTION;
  owl.vy = (owl.vy + t.y * ACCELERATION) * FRICTION;
  if (abs(owl.vx) < STOP_SPEED) owl.vx = 0;
  if (abs(owl.vy) < STOP_SPEED) owl.vy = 0;

  owl.x += owl.vx;
  owl.y += owl.vy;
  stopAtBounds(s);

  if (abs(owl.vx) > 0.3) owl.dir = owl.vx > 0 ? 1 : -1;

  drawTiltGauge(s, t);
  drawShadow(s);
  drawOwl();
  drawHud(s);
}

function trackSensorData() {
  if (!window.sensorsEnabled || gotData) return;
  if (abs(rxDeg) > 0.5 || abs(ryDeg) > 0.5 || abs(degrees(rotationZ)) > 0.5) {
    gotData = true;
    baseX = rxDeg;
    baseY = ryDeg;
  }
}

// Landscape: the phone's long (Y) axis lies horizontal on screen.
// Portrait: the phone's short (X) axis lies horizontal on screen.
function axisInUse() {
  if (TILT_AXIS === 'Y' || TILT_AXIS === 'X') return TILT_AXIS;
  return width > height ? 'Y' : 'X';
}

// Both phone axes drive flight: the one lying horizontal steers left/right,
// the other steers up/down. Each is a delta from the neutral pose captured
// when the sensors first reported (re-centred by tapping).
function readInput() {
  let x = 0;
  let y = 0;

  if (baseX !== null) {
    const horizontal = axisInUse() === 'Y' ? normDeg(rxDeg - baseX) : normDeg(ryDeg - baseY);
    const vertical = axisInUse() === 'Y' ? normDeg(ryDeg - baseY) : normDeg(rxDeg - baseX);
    if (abs(horizontal) > TILT_DEADZONE) {
      x += horizontal * TILT_SENSITIVITY * tiltDir();
    }
    if (abs(vertical) > TILT_DEADZONE) {
      y += vertical * TILT_SENSITIVITY * TILT_DIRECTION_V;
    }
  }

  if (keyIsDown(LEFT_ARROW)) x -= KEY_PUSH;
  if (keyIsDown(RIGHT_ARROW)) x += KEY_PUSH;
  if (keyIsDown(UP_ARROW)) y -= KEY_PUSH;
  if (keyIsDown(DOWN_ARROW)) y += KEY_PUSH;

  return { x: constrain(x, -MAX_FORCE, MAX_FORCE), y: constrain(y, -MAX_FORCE, MAX_FORCE) };
}

function normDeg(d) {
  return ((d + 180) % 360 + 360) % 360 - 180;
}

// The owl flies anywhere in the room: walls stop it left/right/top, and the
// floor line stops it at the bottom so it never sinks into the green band.
function stopAtBounds(s) {
  const hw = owl.w / 2;
  const hh = owl.h / 2;
  if (owl.x < s.x + hw) {
    owl.x = s.x + hw;
    owl.vx = -owl.vx * WALL_BOUNCE;
  } else if (owl.x > s.x + s.w - hw) {
    owl.x = s.x + s.w - hw;
    owl.vx = -owl.vx * WALL_BOUNCE;
  }
  if (owl.y < s.y + hh) {
    owl.y = s.y + hh;
    owl.vy = -owl.vy * WALL_BOUNCE;
  } else if (owl.y > floorY(s) - hh) {
    owl.y = floorY(s) - hh;
    owl.vy = -owl.vy * WALL_BOUNCE;
  }
}

// Wordless 2D tilt indicator: crosshair at the top of the stage with a dot
// showing the push currently being applied (tilt or arrow keys).
function drawTiltGauge(s, t) {
  if (baseX === null) return;
  const cx = s.x + s.w / 2;
  const cy = s.y + 26;
  const span = 26;

  stroke(0, 0, 88, 60);
  strokeWeight(1);
  noFill();
  line(cx - span, cy, cx + span, cy);
  line(cx, cy - span, cx, cy + span);

  noStroke();
  fill(0, 0, 95, 85);
  circle(
    cx + (t.x / MAX_FORCE) * span,
    cy + (t.y / MAX_FORCE) * span,
    10
  );
}

// The owl's shadow on the floor: shrinks and fades the higher it flies, so
// altitude reads at a glance without any text.
function drawShadow(s) {
  const span = floorY(s) - s.y;
  const alt = span > 0 ? constrain((floorY(s) - owl.y) / span, 0, 1) : 0;
  const k = 1 - alt * 0.55;
  noStroke();
  fill(44, 10, 82, 45 * k);
  ellipse(owl.x, floorY(s), owl.w * 0.85 * k, owl.w * 0.18 * k);
}

// All three frames cycle constantly — the wings never stop flapping.
function currentFrame() {
  if (!frames.length) return null;
  return frames[floor(frameCount / (60 / ANIM_FPS)) % frames.length];
}

function drawOwl() {
  push();
  translate(owl.x, owl.y);
  rotate(constrain(owl.vx * SPRITE_LEAN, -0.25, 0.25));

  const img = currentFrame();
  if (img) {
    // The sprite is front-facing and symmetric, so the flip is a no-op today —
    // kept so the code matches the cat and survives a re-facing sprite.
    scale(owl.dir, 1);
    image(img, -owl.w / 2, -owl.h / 2, owl.w, owl.h);
  } else {
    noStroke();
    fill(0, 0, 15);
    ellipse(0, 0, owl.w * 0.8, owl.h * 0.8);
  }
  pop();
}

function flipButtonRect(s) {
  return { x: s.x + s.w - 106, y: s.y + 8, w: 98, h: 30 };
}

// The only direction cue on screen: a drawn arrow (no words) showing which
// way a horizontal tilt pushes the owl.
function drawDirArrow(s) {
  const dir = tiltDir();
  const cx = s.x + 46;
  const cy = s.y + 26;
  const half = 26;
  const head = 16;

  stroke(0, 0, 95);
  strokeWeight(5);
  line(cx - dir * half, cy, cx + dir * half, cy);

  noStroke();
  fill(0, 0, 95);
  const tip = cx + dir * half;
  triangle(tip, cy, tip - dir * head, cy - head * 0.7, tip - dir * head, cy + head * 0.7);
}

function drawHud(s) {
  drawDirArrow(s);
  drawFlipButton(s);
}

// Swap button drawn as two opposed arrows — no words anywhere on screen.
function drawFlipButton(s) {
  const b = flipButtonRect(s);
  const cx = b.x + b.w / 2;
  const half = 26;
  const head = 8;

  noStroke();
  fill(0, 0, 20, 60);
  rect(b.x, b.y, b.w, b.h, 8);

  stroke(0, 0, 95);
  strokeWeight(2.5);
  for (const dir of [1, -1]) {
    const y = b.y + (dir > 0 ? 11 : 19);
    line(cx - dir * half, y, cx + dir * half, y);
    const tip = cx + dir * half;
    line(tip, y, tip - dir * head, y - 5);
    line(tip, y, tip - dir * head, y + 5);
  }
}

function mousePressed() {
  if (width < height) lockLandscape();
  if (window.sensorsEnabled && gotData) {
    const s = stageRect();
    const b = flipButtonRect(s);
    if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) {
      flipTiltDir();
      return false;
    }
    // Anywhere else: re-centre the neutral pose where the phone is now.
    baseX = rxDeg;
    baseY = ryDeg;
  }
  return false;
}
