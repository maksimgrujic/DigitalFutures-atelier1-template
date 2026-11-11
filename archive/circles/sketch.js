let circles = [];
let prevZ = null;
let acc = 0;
let hint = '';

const MIN_COUNT = 1;
const MAX_COUNT = 60;
const BASE_COUNT = 6;
const DEG_PER_CIRCLE = 12;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  lockGestures();
  enableSensorTap('Tap to enable motion sensors');
  hint = window.isDesktop ? 'Drag left / right to spin' : 'Rotate the phone: more spin = more circles';
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(220, 12, 8);

  readSpin();

  const target = constrain(round(BASE_COUNT + acc), MIN_COUNT, MAX_COUNT);
  syncCircles(target);
  updateCircles();
  drawCircles();
  drawHud(target);
}

function readSpin() {
  if (window.sensorsEnabled) {
    if (prevZ !== null) acc += normDeg(rotationZ - prevZ) / DEG_PER_CIRCLE;
    prevZ = rotationZ;
    return;
  }
  prevZ = null;
  if (mouseIsPressed) acc += (mouseX - pmouseX) / DEG_PER_CIRCLE;
}

function normDeg(d) {
  return ((d + 180) % 360 + 360) % 360 - 180;
}

function syncCircles(target) {
  let wanted = 0;
  for (const c of circles) if (!c.dying) wanted++;

  if (wanted < target) {
    for (let i = wanted; i < target; i++) circles.push(spawn());
  } else if (wanted > target) {
    let extra = wanted - target;
    for (let i = circles.length - 1; i >= 0 && extra > 0; i--) {
      if (!circles[i].dying) {
        circles[i].dying = true;
        extra--;
      }
    }
  }
}

function spawn() {
  const pad = 48;
  return {
    x: random(pad, width - pad),
    y: random(pad + 30, height - pad - 30),
    r: random(14, 44),
    hue: random(0, 360),
    spin: random(-0.4, 0.4),
    angle: random(TWO_PI),
    s: 0,
    dying: false
  };
}

function updateCircles() {
  for (let i = circles.length - 1; i >= 0; i--) {
    const c = circles[i];
    c.s = lerp(c.s, c.dying ? 0 : 1, 0.14);
    c.angle += c.spin;
    if (c.dying && c.s < 0.03) circles.splice(i, 1);
  }
}

function drawCircles() {
  noStroke();
  for (const c of circles) {
    push();
    translate(c.x, c.y);
    rotate(c.angle);
    scale(c.s);
    fill(c.hue, 70, 95, 95);
    circle(0, 0, c.r * 2);
    fill(c.hue, 30, 100, 60);
    circle(0, 0, c.r * 0.9);
    pop();
  }
}

function drawHud(target) {
  noStroke();
  fill(0, 0, 90);
  textAlign(LEFT, TOP);
  textSize(18);
  text('circles: ' + target, 16, 16);

  textAlign(CENTER, BOTTOM);
  textSize(14);
  fill(0, 0, 70);
  text(hint, width / 2, height - 16);
}

function mousePressed() {
  return false;
}
