let cat;
let hint = '';

const ACCEL = 0.075;
const FRICTION = 0.972;
const DEADZONE = 7;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  lockGestures();
  enableSensorTap('Tap to enable motion sensors');
  hint = window.isDesktop ? 'Arrow keys to push the cat' : 'Tilt the phone — the cat slides';
  cat = {
    x: width / 2,
    y: height / 2,
    vx: 0,
    vy: 0,
    size: min(width, height) * 0.22,
    dir: 1
  };
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cat.size = min(width, height) * 0.22;
  cat.x = constrain(cat.x, cat.size / 2, width - cat.size / 2);
  cat.y = constrain(cat.y, cat.size / 2, height - cat.size / 2);
}

function draw() {
  background(232, 10, 10);

  const t = readTilt();
  cat.vx += t.x * ACCEL;
  cat.vy += t.y * ACCEL;
  cat.vx *= FRICTION;
  cat.vy *= FRICTION;

  cat.x += cat.vx;
  cat.y += cat.vy;
  stopAtWalls();

  if (abs(cat.vx) > 0.4) cat.dir = cat.vx > 0 ? 1 : -1;

  drawCat();
  drawHud();
}

function readTilt() {
  if (window.sensorsEnabled) {
    const tx = abs(rotationY) > DEADZONE ? rotationY : 0;
    const ty = abs(rotationX) > DEADZONE ? rotationX : 0;
    return { x: tx / 45, y: ty / 45 };
  }
  let x = 0;
  let y = 0;
  if (keyIsDown(LEFT_ARROW)) x -= 45;
  if (keyIsDown(RIGHT_ARROW)) x += 45;
  if (keyIsDown(UP_ARROW)) y -= 45;
  if (keyIsDown(DOWN_ARROW)) y += 45;
  return { x: x / 45, y: y / 45 };
}

function stopAtWalls() {
  const half = cat.size * 0.55;
  if (cat.x < half) {
    cat.x = half;
    cat.vx = 0;
  } else if (cat.x > width - half) {
    cat.x = width - half;
    cat.vx = 0;
  }
  if (cat.y < half) {
    cat.y = half;
    cat.vy = 0;
  } else if (cat.y > height - half) {
    cat.y = height - half;
    cat.vy = 0;
  }
}

function drawCat() {
  const s = cat.size;
  const fur = color(28, 80, 96);
  const dark = color(24, 70, 72);
  const pink = color(350, 70, 92);

  push();
  translate(cat.x, cat.y);
  rotate(constrain(cat.vx * 0.02, -0.3, 0.3));
  if (cat.dir < 0) scale(-1, 1);
  noStroke();

  fill(fur);
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    circle(-s * 0.36 - t * s * 0.34, s * 0.16 - sin(t * PI * 0.95) * s * 0.42, s * 0.2 * (1 - t * 0.45));
  }

  ellipse(0, s * 0.14, s * 0.9, s * 0.62);

  fill(dark);
  triangle(-s * 0.05, s * 0.05, s * 0.1, s * 0.3, -s * 0.16, s * 0.28);
  triangle(s * 0.14, s * 0.08, s * 0.3, s * 0.3, s * 0.06, s * 0.32);

  fill(fur);
  triangle(s * 0.12, -s * 0.36, s * 0.24, -s * 0.14, s * 0.02, -s * 0.16);
  triangle(s * 0.42, -s * 0.38, s * 0.5, -s * 0.14, s * 0.3, -s * 0.12);
  fill(pink);
  triangle(s * 0.15, -s * 0.3, s * 0.21, -s * 0.18, s * 0.07, -s * 0.19);
  triangle(s * 0.42, -s * 0.31, s * 0.46, -s * 0.18, s * 0.33, -s * 0.16);

  ellipse(s * 0.26, -s * 0.05, s * 0.56, s * 0.46);

  fill(dark);
  triangle(s * 0.14, -s * 0.14, s * 0.34, -s * 0.14, s * 0.24, -s * 0.2);

  fill(20, 0, 100);
  ellipse(s * 0.16, -s * 0.06, s * 0.13, s * 0.15);
  ellipse(s * 0.36, -s * 0.06, s * 0.13, s * 0.15);
  fill(20, 0, 20);
  ellipse(s * 0.18, -s * 0.05, s * 0.06, s * 0.09);
  ellipse(s * 0.38, -s * 0.05, s * 0.06, s * 0.09);

  fill(pink);
  triangle(s * 0.22, s * 0.02, s * 0.3, s * 0.02, s * 0.26, s * 0.07);

  stroke(0, 0, 55);
  strokeWeight(1.5);
  line(s * 0.3, s * 0.08, s * 0.56, s * 0.02);
  line(s * 0.3, s * 0.1, s * 0.56, s * 0.12);
  line(s * 0.22, s * 0.08, s * 0.02, s * 0.04);
  line(s * 0.22, s * 0.1, s * 0.02, s * 0.14);
  noStroke();

  pop();
}

function drawHud() {
  noStroke();
  fill(0, 0, 75);
  textAlign(CENTER, BOTTOM);
  textSize(14);
  text(hint, width / 2, height - 16);
}

function mousePressed() {
  return false;
}
