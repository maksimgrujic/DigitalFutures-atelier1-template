// ======================================================================
//  TUNE THE FEEL HERE
// ======================================================================
const TILT_AXIS = 'auto';        // 'auto' = measure across whichever phone axis is
                                 //       horizontal on screen, or force 'Y' / 'X'
const TILT_DIRECTION_Y = -1;     // starting direction in landscape (phone Y axis)
const TILT_DIRECTION_X = 1;      // starting direction in portrait (phone X axis)
const DIR_VERSION = 3;           // bump this whenever the two defaults above change,
                                 // so stale saved flips from older builds are ignored
const TILT_SENSITIVITY = 1 / 20; // how hard each degree of tilt pushes (bigger = snappier)
const TILT_DEADZONE = 4;         // degrees of tilt ignored, stops drift when holding still
const MAX_FORCE = 2.5;           // cap on push per frame, keeps the cat from teleporting
const ACCELERATION = 0.16;       // how fast push becomes speed (bigger = more instant)
const FRICTION = 0.97;           // 0.8 = stops fast / sticky floor, 0.99 = slippery ice
const STOP_SPEED = 0.02;         // below this speed the cat snaps to a full stop
const WALL_BOUNCE = 0;           // 0 = sticks to the wall, 0.5 = soft bounce, 1 = full bounce
const KEY_PUSH = 1;              // how hard the arrow keys push
const START_GAP = 12;            // px above the floor where the cat spawns
const SPRITE_SIZE = 0.28;        // cat width as a fraction of the smaller stage side
const SPRITE_LEAN = 0.015;       // how much the cat leans while moving (0 = no lean)
const STAGE_ASPECT = 16 / 9;     // the play area is always this shape (landscape)
const MOTION_THRESHOLD = 1.0;    // speed (px/frame) where idle switches to the In Motion sprite
const WALL_TOUCH_SPEED = 1.0;    // speed below this while at a wall shows the Squashed sprite
const BUILD_TAG = '2026-11-11-e'; // not drawn on screen any more, but bumped on every
                                  // deploy so the repo always says which build is live
                                  // (matches index.html ?v=)
// ======================================================================

const SHEET_SPRITE = 'catpotionsprite.png';
// The sheet is one strip of three equal cells, and every frame's artwork sits
// at the same offset inside its cell — so one crop rect pulls out all three.
const SHEET_CELL_W = 48;
const SHEET_FRAME = { x: 8, y: 8, w: 32, h: 48 };
const BACKDROP_SPRITE = 'Backdrop Potion.png';

let backdrop = null;

let sprites = { idle: null, motion: null, squash: null };
let cat = null;

let baseX = null;
let baseY = null;
let gotData = false;
let rxDeg = 0;
let ryDeg = 0;
// One direction setting per measured axis. A saved flip is only honoured if it
// was saved at the current DIR_VERSION — old builds can't haunt the new one.
let tiltDirs = { Y: TILT_DIRECTION_Y, X: TILT_DIRECTION_X };

function loadTiltDirs() {
  try {
    const s = JSON.parse(localStorage.getItem('catTiltDir'));
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
      'catTiltDir',
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
  sprites.idle = sheetFrame(sheet, 0);   // frame 1: base state
  sprites.motion = sheetFrame(sheet, 1); // frame 2: in motion
  sprites.squash = sheetFrame(sheet, 2); // frame 3: contact with the wall
  backdrop = await loadSprite(BACKDROP_SPRITE);
  makeCat();
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

function makeCat() {
  const s = stageRect();
  const size = min(s.w, s.h) * SPRITE_SIZE;
  const aspect = sprites.idle ? sprites.idle.height / sprites.idle.width : 1;
  cat = {
    x: s.x + s.w / 2,
    y: s.y + s.h - (size * aspect) / 2 - START_GAP,
    vx: 0,
    vy: 0,
    w: size,
    h: size * aspect,
    dir: 1,
    touchWall: null
  };
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  const s = stageRect();
  cat.w = min(s.w, s.h) * SPRITE_SIZE;
  cat.h = cat.w * (sprites.idle ? sprites.idle.height / sprites.idle.width : 1);
  cat.x = constrain(cat.x, s.x + cat.w / 2, s.x + s.w - cat.w / 2);
  cat.y = constrain(cat.y, s.y + cat.h / 2, s.y + s.h - cat.h / 2);
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
  cat.vx = (cat.vx + t.x * ACCELERATION) * FRICTION;
  cat.vy = (cat.vy + t.y * ACCELERATION) * FRICTION;
  if (abs(cat.vx) < STOP_SPEED) cat.vx = 0;
  if (abs(cat.vy) < STOP_SPEED) cat.vy = 0;

  cat.x += cat.vx;
  cat.y += cat.vy;
  stopAtWalls(s);

  if (abs(cat.vx) > 0.3) cat.dir = cat.vx > 0 ? 1 : -1;

  drawTiltGauge(s);
  drawCat();
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

// Delta, in degrees, from the neutral pose = gravity along the screen's horizontal axis.
function tiltDelta() {
  if (baseX === null) return 0;
  return axisInUse() === 'Y' ? normDeg(rxDeg - baseX) : normDeg(ryDeg - baseY);
}

function readInput() {
  let x = 0;
  let y = 0;

  const d = tiltDelta();
  if (abs(d) > TILT_DEADZONE) {
    const push = d * TILT_SENSITIVITY * tiltDir();
    if (axisInUse() === 'Y') x += push;
    else y += push;
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

function stopAtWalls(s) {
  const hw = cat.w / 2;
  const hh = cat.h / 2;
  cat.touchWall = null;
  if (cat.x < s.x + hw) {
    cat.x = s.x + hw;
    cat.vx = -cat.vx * WALL_BOUNCE;
    cat.touchWall = 'left';
  } else if (cat.x > s.x + s.w - hw) {
    cat.x = s.x + s.w - hw;
    cat.vx = -cat.vx * WALL_BOUNCE;
    cat.touchWall = 'right';
  }
  if (cat.y < s.y + hh) {
    cat.y = s.y + hh;
    cat.vy = -cat.vy * WALL_BOUNCE;
    cat.touchWall = 'top';
  } else if (cat.y > s.y + s.h - hh) {
    cat.y = s.y + s.h - hh;
    cat.vy = -cat.vy * WALL_BOUNCE;
    cat.touchWall = 'bottom';
  }
}

function drawTiltGauge(s) {
  if (baseX === null) return;
  const d = constrain(tiltDelta() * tiltDir(), -45, 45);
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  const span = 60;

  stroke(0, 0, 88, 60);
  strokeWeight(1);
  noFill();
  if (axisInUse() === 'Y') {
    line(cx - span, cy, cx + span, cy);
    noStroke();
    fill(0, 0, 95, 85);
    circle(cx + (d / 45) * span, cy, 12);
  } else {
    line(cx, cy - span, cx, cy + span);
    noStroke();
    fill(0, 0, 95, 85);
    circle(cx, cy + (d / 45) * span, 12);
  }
}

function catSpeed() {
  return sqrt(cat.vx * cat.vx + cat.vy * cat.vy);
}

// Squashed while pressed against a wall, In Motion past the speed threshold, else idle.
function currentSprite() {
  const v = catSpeed();
  if (cat.touchWall && v <= WALL_TOUCH_SPEED) {
    return sprites.squash || sprites.idle;
  }
  if (v > MOTION_THRESHOLD) {
    return sprites.motion || sprites.idle;
  }
  return sprites.idle;
}

function drawCat() {
  push();
  translate(cat.x, cat.y);
  rotate(constrain(cat.vx * SPRITE_LEAN, -0.25, 0.25));

  noStroke();
  fill(44, 10, 82, 45);
  ellipse(0, cat.h * 0.5, cat.w * 0.85, cat.h * 0.2);

  const img = currentSprite();
  if (img) {
    scale(cat.dir, 1);
    image(img, -cat.w / 2, -cat.h / 2, cat.w, cat.h);
  } else {
    fill(0, 0, 15);
    ellipse(0, 0, cat.w * 0.8, cat.h * 0.8);
  }
  pop();
}

function flipButtonRect(s) {
  return { x: s.x + s.w - 106, y: s.y + 8, w: 98, h: 30 };
}

// The only direction cue on screen: a drawn arrow (no words) showing which
// way a tilt pushes the cat.
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
    baseX = rxDeg;
    baseY = ryDeg;
  }
  return false;
}
