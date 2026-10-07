// ======================================================================
//  TUNE THE FEEL HERE
// ======================================================================
const TILT_SENSITIVITY = 1 / 20; // how hard each degree of tilt pushes (bigger = snappier)
const TILT_DEADZONE = 4;         // degrees of tilt ignored, stops drift when holding still
const MAX_FORCE = 2.5;           // cap on push per frame, keeps the cat from teleporting
const ACCELERATION = 0.16;       // how fast push becomes speed (bigger = more instant)
const FRICTION = 0.97;           // 0.8 = stops fast / sticky floor, 0.99 = slippery ice
const STOP_SPEED = 0.02;         // below this speed the cat snaps to a full stop
const WALL_BOUNCE = 0;           // 0 = sticks to the wall, 0.5 = soft bounce, 1 = full bounce
const DRAG_PUSH = 1 / 25;        // how hard a finger/mouse drag pushes (both axes)
const KEY_PUSH = 1;              // how hard the arrow keys push
const TILT_X_ONLY = true;        // true = tilt only slides the cat left/right
const SPRITE_SIZE = 0.28;        // cat width as a fraction of the smaller screen side
const SPRITE_LEAN = 0.015;       // how much the cat leans while moving (0 = no lean)
// ======================================================================

let sprite = null;
let cat = null;
let hint = '';

let baseX = null;
let baseY = null;
let gotData = false;
let rxDeg = 0;
let ryDeg = 0;

async function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noSmooth();
  lockGestures();
  enableSensorTap('Tap to enable motion sensors');
  if (window.isDesktop) showDesktopQr({ label: 'Scan to test on your phone' });
  hint = window.isDesktop ? 'Drag or use the arrow keys' : 'Tilt sideways to slide — tap to re-center';

  try {
    sprite = await loadImage('pixelartcat.png');
  } catch (e) {
    sprite = null;
  }
  makeCat();
}

function makeCat() {
  const s = min(width, height) * SPRITE_SIZE;
  const aspect = sprite ? sprite.height / sprite.width : 1;
  cat = {
    x: width / 2,
    y: height / 2,
    vx: 0,
    vy: 0,
    w: s,
    h: s * aspect,
    dir: 1
  };
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  makeCat();
  cat.x = constrain(cat.x, cat.w / 2, width - cat.w / 2);
  cat.y = constrain(cat.y, cat.h / 2, height - cat.h / 2);
}

function userSetupComplete() {
  gotData = false;
  baseX = null;
  baseY = null;
}

function draw() {
  background(44, 8, 97);

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
  stopAtWalls();

  if (abs(cat.vx) > 0.3) cat.dir = cat.vx > 0 ? 1 : -1;

  drawTiltGauge();
  drawCat();
  drawHud();
}

function trackSensorData() {
  if (!window.sensorsEnabled || gotData) return;
  if (abs(rxDeg) > 0.5 || abs(ryDeg) > 0.5 || abs(degrees(rotationZ)) > 0.5) {
    gotData = true;
    baseX = rxDeg;
    baseY = ryDeg;
  }
}

function readInput() {
  let x = 0;
  let y = 0;

  if (baseX !== null) {
    const dx = ryDeg - baseY;
    const dy = normDeg(rxDeg - baseX);
    if (abs(dx) > TILT_DEADZONE) x += dx * TILT_SENSITIVITY;
    if (!TILT_X_ONLY && abs(dy) > TILT_DEADZONE) y += dy * TILT_SENSITIVITY;
  }

  if (keyIsDown(LEFT_ARROW)) x -= KEY_PUSH;
  if (keyIsDown(RIGHT_ARROW)) x += KEY_PUSH;
  if (keyIsDown(UP_ARROW)) y -= KEY_PUSH;
  if (keyIsDown(DOWN_ARROW)) y += KEY_PUSH;

  if (mouseIsPressed) {
    x += (mouseX - pmouseX) * DRAG_PUSH;
    y += (mouseY - pmouseY) * DRAG_PUSH;
  }

  return { x: constrain(x, -MAX_FORCE, MAX_FORCE), y: constrain(y, -MAX_FORCE, MAX_FORCE) };
}

function normDeg(d) {
  return ((d + 180) % 360 + 360) % 360 - 180;
}

function stopAtWalls() {
  const hw = cat.w / 2;
  const hh = cat.h / 2;
  if (cat.x < hw) {
    cat.x = hw;
    cat.vx = -cat.vx * WALL_BOUNCE;
  } else if (cat.x > width - hw) {
    cat.x = width - hw;
    cat.vx = -cat.vx * WALL_BOUNCE;
  }
  if (cat.y < hh) {
    cat.y = hh;
    cat.vy = -cat.vy * WALL_BOUNCE;
  } else if (cat.y > height - hh) {
    cat.y = height - hh;
    cat.vy = -cat.vy * WALL_BOUNCE;
  }
}

function drawTiltGauge() {
  if (baseX === null) return;
  const dx = constrain(ryDeg - baseY, -45, 45);
  const cy = height / 2;
  const span = 60;

  stroke(0, 0, 75, 45);
  strokeWeight(1);
  line(width / 2 - span, cy, width / 2 + span, cy);

  noStroke();
  fill(0, 0, 30, 70);
  circle(width / 2 + (dx / 45) * span, cy, 12);
}

function drawCat() {
  push();
  translate(cat.x, cat.y);
  rotate(constrain(cat.vx * SPRITE_LEAN, -0.25, 0.25));

  noStroke();
  fill(44, 10, 82, 45);
  ellipse(0, cat.h * 0.5, cat.w * 0.85, cat.h * 0.2);

  if (sprite) {
    scale(cat.dir, 1);
    image(sprite, -cat.w / 2, -cat.h / 2, cat.w, cat.h);
  } else {
    fill(0, 0, 15);
    ellipse(0, 0, cat.w * 0.8, cat.h * 0.8);
  }
  pop();
}

function drawHud() {
  noStroke();
  textAlign(CENTER, TOP);
  textSize(26);

  if (!window.sensorsEnabled) {
    fill(0, 0, 40);
    text('tap to enable motion', width / 2, 18);
  } else if (!gotData) {
    fill(0, 80, 60);
    textSize(18);
    text('waiting for sensor data…\nif this never changes, enable\nMotion & Orientation for this site', width / 2, 18);
  } else {
    fill(0, 0, 35);
    text('tilt  ' + nf(ryDeg - baseY, 1, 1) + '\u00B0', width / 2, 18);
  }

  fill(0, 0, 55);
  textAlign(CENTER, BOTTOM);
  textSize(14);
  text(hint, width / 2, height - 16);
}

function mousePressed() {
  if (window.sensorsEnabled && gotData) {
    baseX = rxDeg;
    baseY = ryDeg;
  }
  return false;
}
