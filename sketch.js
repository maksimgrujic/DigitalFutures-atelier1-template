// ======================================================================
//  TUNE THE FEEL HERE
// ======================================================================
const TILT_AXIS = 'auto';        // 'auto' = measure across whichever phone axis is
                                 //       horizontal on screen, or force 'Y' / 'X'
const TILT_DIRECTION_Y = -1;     // starting direction in landscape (phone Y axis)
const TILT_DIRECTION_X = 1;      // starting direction in portrait (phone X axis)
const DIR_VERSION = 2;           // bump this whenever the two defaults above change,
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
// ======================================================================

const IDLE_SPRITE = 'Gemini Cat.png';
const MOTION_SPRITE = 'Gemini Cat (In Motion).png';
const SQUASH_SPRITE = 'Gemini Cat (Squashed).png';
const BACKDROP_SPRITE = 'Backdrop Potion.png';

let backdrop = null;

let sprites = { idle: null, motion: null, squash: null };
let cat = null;
let hint = '';

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
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noSmooth();
  lockGestures();
  enableSensorTap('Tap to enable motion sensors');
  if (window.isDesktop) showDesktopQr({ label: 'Scan to test on your phone' });

  sprites.idle = await loadSprite(IDLE_SPRITE);
  sprites.motion = await loadSprite(MOTION_SPRITE);
  sprites.squash = await loadSprite(SQUASH_SPRITE);
  backdrop = await loadSprite(BACKDROP_SPRITE);
  makeCat();
  updateHint();
}

async function loadSprite(name) {
  try {
    return await loadImage(encodeURI(name));
  } catch (e) {
    return null;
  }
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
  updateHint();
}

function updateHint() {
  if (width < height && !window.isDesktop) {
    hint = 'rotate your phone sideways for full screen — tap to re-center';
  } else if (window.isDesktop) {
    hint = 'use the arrow keys';
  } else {
    hint = 'tilt to slide — tap to re-center';
  }
}

function userSetupComplete() {
  gotData = false;
  baseX = null;
  baseY = null;
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

function drawHud(s) {
  noStroke();
  textAlign(CENTER, TOP);
  textSize(26);

  if (!window.sensorsEnabled) {
    fill(0, 0, 92);
    text('tap to enable motion', s.x + s.w / 2, s.y + 14);
  } else if (!gotData) {
    fill(0, 85, 75);
    textSize(18);
    text(
      'waiting for sensor data…\nif this never changes, enable\nMotion & Orientation for this site',
      s.x + s.w / 2,
      s.y + 14
    );
  } else {
    fill(0, 0, 92);
    text(
      'tilt ' + axisInUse() + '  ' + nf(tiltDelta(), 1, 1) + '\u00B0' +
        '   dir ' + (tiltDir() > 0 ? '\u2192' : '\u2190'),
      s.x + s.w / 2,
      s.y + 14
    );
    fill(0, 0, 78);
    textSize(13);
    text('tap the gauge to flip direction', s.x + s.w / 2, s.y + 50);
  }

  fill(0, 0, 85);
  textAlign(CENTER, BOTTOM);
  textSize(14);
  text(hint, s.x + s.w / 2, s.y + s.h - 10);
}

function mousePressed() {
  if (window.sensorsEnabled && gotData) {
    const s = stageRect();
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    if (abs(mouseX - cx) < 95 && abs(mouseY - cy) < 55) {
      flipTiltDir();
      return false;
    }
    baseX = rxDeg;
    baseY = ryDeg;
  }
  return false;
}
