let sprite = null;
let cat = null;
let hint = '';

let baseX = null;
let baseY = null;
let gotData = false;
let rxDeg = 0;
let ryDeg = 0;

const ACCEL = 0.14;
const FRICTION = 0.97;
const DEADZONE = 5;

async function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noSmooth();
  lockGestures();
  enableSensorTap('Tap to enable motion sensors');
  if (window.isDesktop) showDesktopQr({ label: 'Scan to test on your phone' });
  hint = window.isDesktop ? 'Drag anywhere or use the arrow keys' : 'Tilt to slide — tap to re-center';

  try {
    sprite = await loadImage('pixelartcat.png');
  } catch (e) {
    sprite = null;
  }
  makeCat();
}

function makeCat() {
  const s = min(width, height) * 0.28;
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
  cat.vx = (cat.vx + t.x * ACCEL) * FRICTION;
  cat.vy = (cat.vy + t.y * ACCEL) * FRICTION;
  if (abs(cat.vx) < 0.02) cat.vx = 0;
  if (abs(cat.vy) < 0.02) cat.vy = 0;

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
    if (abs(dx) > DEADZONE) x += dx / 25;
    if (abs(dy) > DEADZONE) y += dy / 25;
  }

  if (keyIsDown(LEFT_ARROW)) x -= 1;
  if (keyIsDown(RIGHT_ARROW)) x += 1;
  if (keyIsDown(UP_ARROW)) y -= 1;
  if (keyIsDown(DOWN_ARROW)) y += 1;

  if (mouseIsPressed) {
    x += (mouseX - pmouseX) / 25;
    y += (mouseY - pmouseY) / 25;
  }

  return { x: constrain(x, -2.5, 2.5), y: constrain(y, -2.5, 2.5) };
}

function normDeg(d) {
  return ((d + 180) % 360 + 360) % 360 - 180;
}

function stopAtWalls() {
  const hw = cat.w / 2;
  const hh = cat.h / 2;
  if (cat.x < hw) {
    cat.x = hw;
    cat.vx = 0;
  } else if (cat.x > width - hw) {
    cat.x = width - hw;
    cat.vx = 0;
  }
  if (cat.y < hh) {
    cat.y = hh;
    cat.vy = 0;
  } else if (cat.y > height - hh) {
    cat.y = height - hh;
    cat.vy = 0;
  }
}

function drawTiltGauge() {
  if (baseX === null) return;
  const dx = constrain(ryDeg - baseY, -45, 45);
  const dy = constrain(normDeg(rxDeg - baseX), -45, 45);
  const cx = width / 2;
  const cy = height / 2;

  stroke(0, 0, 75, 50);
  strokeWeight(1);
  noFill();
  circle(cx, cy, 90);

  stroke(0, 0, 30, 60);
  strokeWeight(3);
  point(cx + (dx / 45) * 45, cy + (dy / 45) * 45);
  noStroke();
}

function drawCat() {
  push();
  translate(cat.x, cat.y);
  rotate(constrain(cat.vx * 0.015, -0.25, 0.25));

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
    const dx = ryDeg - baseY;
    const dy = normDeg(rxDeg - baseX);
    text('tilt  ' + nf(dx, 1, 1) + '\u00B0  ' + nf(dy, 1, 1) + '\u00B0', width / 2, 18);
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
