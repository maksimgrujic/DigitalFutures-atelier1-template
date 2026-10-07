// ======================================================================
//  TUNE THE FEEL HERE
// ======================================================================
const TILT_AXIS = 'Y';           // 'Y' = across the phone's long axis (landscape: slides
                                 //       the cat left/right), 'X' = across the short axis
const TILT_SENSITIVITY = 1 / 20; // how hard each degree of tilt pushes (bigger = snappier)
const TILT_DEADZONE = 4;         // degrees of tilt ignored, stops drift when holding still
const MAX_FORCE = 2.5;           // cap on push per frame, keeps the cat from teleporting
const ACCELERATION = 0.16;       // how fast push becomes speed (bigger = more instant)
const FRICTION = 0.97;           // 0.8 = stops fast / sticky floor, 0.99 = slippery ice
const STOP_SPEED = 0.02;         // below this speed the cat snaps to a full stop
const WALL_BOUNCE = 0;           // 0 = sticks to the wall, 0.5 = soft bounce, 1 = full bounce
const DRAG_PUSH = 1 / 25;        // how hard a finger/mouse drag pushes (both axes)
const KEY_PUSH = 1;              // how hard the arrow keys push
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
let triedLandscape = false;

async function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noSmooth();
  lockGestures();
  enableSensorTap('Tap to enable motion sensors');
  if (window.isDesktop) showDesktopQr({ label: 'Scan to test on your phone' });

  try {
    sprite = await loadImage('pixelartcat.png');
  } catch (e) {
    sprite = null;
  }
  makeCat();
  updateHint();
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
  if (gotData) {
    baseX = degrees(rotationX);
    baseY = degrees(rotationY);
  }
  updateHint();
}

function updateHint() {
  const landscape = width > height;
  if (!landscape && !window.isDesktop) {
    hint = 'turn your phone sideways — then tap to re-center';
  } else if (window.isDesktop) {
    hint = 'Drag or use the arrow keys';
  } else {
    hint = 'tilt to slide — tap to re-center';
  }
}

function userSetupComplete() {
  gotData = false;
  baseX = null;
  baseY = null;
  lockLandscape();
}

function lockLandscape() {
  if (triedLandscape) return;
  triedLandscape = true;
  try {
    const el = document.documentElement;
    const p = el.requestFullscreen ? el.requestFullscreen() : null;
    if (p && p.then) {
      p.then(function () {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(function () {});
        }
      }).catch(function () {});
    }
  } catch (e) {}
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

// Delta, in degrees, from the neutral pose on the selected phone axis.
// Phone Y axis (long edge) is driven by tipping about X -> p5 rotationX (beta).
// Phone X axis (short edge) is driven by tipping about Y -> p5 rotationY (gamma).
function tiltDelta() {
  if (baseX === null) return 0;
  return TILT_AXIS === 'Y' ? normDeg(rxDeg - baseX) : normDeg(ryDeg - baseY);
}

function readInput() {
  let x = 0;
  let y = 0;

  const d = tiltDelta();
  if (abs(d) > TILT_DEADZONE) {
    const push = d * TILT_SENSITIVITY;
    if (TILT_AXIS === 'Y') x += push;
    else y += push;
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
  const d = constrain(tiltDelta(), -45, 45);

  stroke(0, 0, 75, 45);
  strokeWeight(1);
  noFill();
  if (TILT_AXIS === 'Y') {
    const span = 60;
    line(width / 2 - span, height / 2, width / 2 + span, height / 2);
    noStroke();
    fill(0, 0, 30, 70);
    circle(width / 2 + (d / 45) * span, height / 2, 12);
  } else {
    const span = 60;
    line(width / 2, height / 2 - span, width / 2, height / 2 + span);
    noStroke();
    fill(0, 0, 30, 70);
    circle(width / 2, height / 2 + (d / 45) * span, 12);
  }
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
    text('tilt ' + TILT_AXIS + '  ' + nf(tiltDelta(), 1, 1) + '\u00B0', width / 2, 18);
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
  lockLandscape();
  return false;
}
