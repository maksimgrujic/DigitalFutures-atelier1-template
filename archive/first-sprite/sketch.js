let sprite = null;
let cat = null;
let hint = '';

const ACCEL = 0.09;
const FRICTION = 0.96;
const DEADZONE = 6;

async function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noSmooth();
  lockGestures();
  enableSensorTap('Tap to enable motion sensors');
  if (window.isDesktop) showDesktopQr({ label: 'Scan to test on your phone' });
  hint = window.isDesktop ? 'Drag anywhere or use the arrow keys' : 'Tilt the phone — or drag the cat';

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

function draw() {
  background(44, 8, 97);

  const t = readInput();
  cat.vx = (cat.vx + t.x * ACCEL) * FRICTION;
  cat.vy = (cat.vy + t.y * ACCEL) * FRICTION;
  if (abs(cat.vx) < 0.02) cat.vx = 0;
  if (abs(cat.vy) < 0.02) cat.vy = 0;

  cat.x += cat.vx;
  cat.y += cat.vy;
  stopAtWalls();

  if (abs(cat.vx) > 0.3) cat.dir = cat.vx > 0 ? 1 : -1;

  drawCat();
  drawHud();
}

function readInput() {
  let x = 0;
  let y = 0;

  if (window.sensorsEnabled) {
    if (abs(rotationY) > DEADZONE) x += rotationY / 40;
    if (abs(rotationX) > DEADZONE) y += rotationX / 40;
  }

  if (keyIsDown(LEFT_ARROW)) x -= 1;
  if (keyIsDown(RIGHT_ARROW)) x += 1;
  if (keyIsDown(UP_ARROW)) y -= 1;
  if (keyIsDown(DOWN_ARROW)) y += 1;

  if (mouseIsPressed) {
    x += (mouseX - pmouseX) / 12;
    y += (mouseY - pmouseY) / 12;
  }

  return { x: constrain(x, -3, 3), y: constrain(y, -3, 3) };
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
  fill(0, 0, 35);
  textAlign(LEFT, TOP);
  textSize(13);
  if (window.sensorsEnabled) {
    text(
      'tilt  X ' + nf(rotationX, 1, 1) + '   Y ' + nf(rotationY, 1, 1) + '   Z ' + nf(rotationZ, 1, 1),
      14,
      14
    );
  } else {
    text('sensors off — tap the overlay, or drag / arrow keys', 14, 14);
  }

  fill(0, 0, 55);
  textAlign(CENTER, BOTTOM);
  textSize(14);
  text(hint, width / 2, height - 16);
}

function mousePressed() {
  return false;
}
