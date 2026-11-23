(() => {
  const root = document.getElementById('loy-krathong');
  const canvas = root.querySelector('canvas');
  const actions = root.querySelector('.actions');
  const button = root.querySelector('.release');
  const buttonLabel = button.querySelector('span');
  const wish = root.querySelector('#wish');
  const wishField = wish.closest('.wish');
  const sentWish = root.querySelector('.sent-wish');
  const hint = root.querySelector('.pond-hint');
  const message = root.querySelector('[role="status"]');
  const ctx = canvas.getContext('2d');
  const backdrop = document.createElement('canvas');
  const bg = backdrop.getContext('2d');
  if (!ctx || !bg) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const landscape = matchMedia('(max-height: 540px) and (min-aspect-ratio: 4/3) and (min-width: 500px)');
  const floatDuration = 4.3;
  const tau = Math.PI * 2;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const lerp = (from, to, t) => from + (to - from) * t;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const fade = t => t * t * (3 - 2 * t);
  let seed = 437;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const stars = Array.from({length: 95}, () =>
    [random(), random() * 0.34, 0.35 + random() * 1.05, random()]);
  const water = Array.from({length: 132}, () =>
    [random(), random(), random(), random()]);
  const fireflies = Array.from({length: 18}, () =>
    [random(), 0.35 + random() * 0.47, random() * tau, random()]);
  const fireworks = [
    {start: 0.24, climb: 0.64, across: 0.19, altitude: 0.36, size: 0.96, colors: ['#ffd680', '#ff9d68', '#fff1ce']},
    {start: 0.88, climb: 0.67, across: 0.84, altitude: 0.41, size: 0.75, colors: ['#ffa4cf', '#f978b7', '#ffe0dd']},
    {start: 1.55, climb: 0.78, across: 0.52, altitude: 0.29, size: 1.09, colors: ['#c9a7ff', '#91bfff', '#fff0cd']}
  ].map(burst => ({
    ...burst,
    sparks: Array.from({length: 62}, (_, i) => {
      const inner = i >= 44;
      const angle = ((inner ? (i - 44) / 18 : i / 44) + random() * 0.015) * tau;
      const velocity = inner ? 0.24 + random() * 0.44 : 0.76 + random() * 0.34;
      return {
        dx: Math.cos(angle) * velocity,
        dy: Math.sin(angle) * velocity,
        life: 1.14 + random() * 0.75,
        phase: random() * tau,
        size: 0.65 + random() * 0.85,
        color: burst.colors[i % burst.colors.length]
      };
    })
  }));
  const shoreLights = [
    [0.08, 0.38, 0.2], [0.115, 0.397, 0.8], [0.144, 0.394, 0.3],
    [0.218, 0.413, 0.6], [0.82, 0.405, 0.8], [0.889, 0.395, 1],
    [0.93, 0.389, 0.56], [0.97, 0.383, 0.24]
  ];
  let width = 0;
  let height = 0;
  let ratio = 1;
  let horizon = 0;
  let moonX = 0;
  let moonY = 0;
  let moonRadius = 0;
  let startX = 0;
  let startY = 0;
  let travelWidth = 0;
  let gesture = null;
  let dragOffset = 0;
  let float = null;
  let direction = 1;
  let frame = null;
  let lastDraw = -Infinity;
  let returnMotion = null;

  function ellipse(context, x, y, rx, ry, color, rotation = 0) {
    context.beginPath();
    context.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotation, 0, tau);
    context.fillStyle = color;
    context.fill();
  }
  function halo(context, x, y, radius, stops, squash = 1) {
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    context.save();
    context.translate(x, y);
    context.scale(1, squash);
    context.fillStyle = gradient;
    context.fillRect(-radius, -radius, radius * 2, radius * 2);
    context.restore();
  }

  function shore(phase, color, level, rise) {
    bg.beginPath();
    bg.moveTo(0, horizon + 13);
    for (let i = 0; i <= 120; i++) {
      const x = i / 120;
      const edge = Math.pow(Math.abs(2 * x - 1), 1.85);
      const tree = Math.abs(Math.sin(x * 165 + phase) * Math.cos(x * 37 + phase));
      const crest = edge * rise * (0.62 + 0.22 * Math.sin(x * 31 + phase) + 0.23 * tree);
      bg.lineTo(width * x, horizon - crest + level + Math.sin(x * 43 + phase) * 2);
    }
    bg.lineTo(width, horizon + 13);
    bg.closePath();
    bg.fillStyle = color;
    bg.fill();
  }

  function pads(x, y, radius, angle, bloom) {
    bg.save();
    bg.translate(x, y);
    bg.rotate(angle);
    ellipse(bg, 1, 4, radius * 1.06, radius * 0.34, '#080e23a8');
    bg.scale(1, 0.32);
    bg.beginPath();
    bg.moveTo(0, 0);
    bg.arc(0, 0, radius, 0.23, tau - 0.36);
    bg.closePath();
    const leaf = bg.createLinearGradient(-radius, -radius, radius, radius);
    leaf.addColorStop(0, '#235a5d');
    leaf.addColorStop(0.46, '#367a70');
    leaf.addColorStop(1, '#173d49');
    bg.fillStyle = leaf;
    bg.fill();
    bg.lineWidth = 1;
    bg.strokeStyle = '#8abca648';
    bg.stroke();
    for (let i = 1; i <= 6; i++) {
      const a = i * 0.81;
      bg.beginPath();
      bg.moveTo(0, 0);
      bg.quadraticCurveTo(Math.cos(a + 0.18) * radius * 0.5, Math.sin(a + 0.18) * radius * 0.5,
        Math.cos(a) * radius * 0.88, Math.sin(a) * radius * 0.88);
      bg.stroke();
    }
    bg.restore();
    if (!bloom) return;
    bg.save();
    bg.translate(x + radius * 0.27, y - radius * 0.01);
    for (const [a, color] of [[-0.99, '#a4598f'], [0.9, '#aa669f'], [-0.56, '#f09dbb'],
      [0.54, '#e480aa'], [-0.16, '#ffbeb9'], [0.21, '#ffb1c8'], [1.17, '#cd77a6']]) {
      bg.save();
      bg.rotate(a);
      bg.beginPath();
      bg.moveTo(0, 0);
      bg.quadraticCurveTo(-radius * 0.18, -radius * 0.28, 0, -radius * 0.57);
      bg.quadraticCurveTo(radius * 0.2, -radius * 0.28, 0, 0);
      bg.fillStyle = color;
      bg.fill();
      bg.restore();
    }
    ellipse(bg, 0, -radius * 0.09, radius * 0.08, radius * 0.045, '#ffd18c');
    bg.restore();
  }

  // Distant chedis and a layered temple roof behind the tree line.
  function temple(x, scale) {
    bg.save();
    bg.translate(x, horizon + 4);
    bg.scale(scale, scale);
    bg.fillStyle = '#322a43';
    function chedi(offset, height) {
      bg.save();
      bg.translate(offset, 0);
      bg.scale(height / 100, height / 100);
      bg.beginPath();
      bg.moveTo(-27, 0);
      for (const [w, y] of [[25,-8],[20,-10],[19,-15],[15,-17],[13,-25],
        [9,-29],[6,-39],[7,-41],[5,-44],[5,-47],[3,-49],[2,-65],[0,-89]]) {
        bg.lineTo(-w, y);
      }
      for (const [w,y] of [[2,-65],[3,-49],[5,-47],[5,-44],[7,-41],[6,-39],
        [9,-29],[13,-25],[15,-17],[19,-15],[20,-10],[25,-8],[27,0]]) bg.lineTo(w,y);
      bg.fill();
      bg.restore();
    }
    chedi(-61, 53);
    chedi(-37, 90);
    chedi(69, 50);
    bg.fillRect(-3, -18, 48, 20);
    for (let i = 0; i < 3; i++) {
      const y = -17 - i * 8;
      const w = 36 - i * 7;
      bg.beginPath();
      bg.moveTo(20-w, y-6);
      bg.quadraticCurveTo(22-w, y+1, 20, y-22+i*2);
      bg.quadraticCurveTo(18+w, y+1, 20+w, y-6);
      bg.lineTo(17+w, y+2);
      bg.lineTo(23-w, y+2);
      bg.fill();
    }
    bg.fillStyle = '#f2be8c';
    for (let i = 0; i < 5; i++) bg.fillRect(2+i*9, -10, 1.5, 3);
    bg.restore();
  }

  function paintBackdrop() {
    bg.setTransform(ratio, 0, 0, ratio, 0, 0);
    const sky = bg.createLinearGradient(0, 0, 0, horizon + 14);
    sky.addColorStop(0, '#0e142e');
    sky.addColorStop(0.6, '#343152');
    sky.addColorStop(1, '#966879');
    bg.fillStyle = sky;
    bg.fillRect(0, 0, width, height);
    halo(bg, moonX, moonY, moonRadius * 4.2,
      [[0, '#ffd6af57'], [0.34, '#f1a1a02d'], [1, '#f193b400']]);
    for (const [x, y, size, strength] of stars) {
      if (Math.hypot(x * width - moonX, y * height - moonY) < moonRadius + 4) continue;
      ellipse(bg, x * width, y * height, size, size, 'rgba(255,231,222,' + (0.23 + strength * 0.58) + ')');
      if (strength > 0.94) {
        bg.fillStyle = '#ffdfcc62';
        bg.fillRect(x * width - 3, y * height - 0.35, 6, 0.7);
        bg.fillRect(x * width - 0.35, y * height - 3, 0.7, 6);
      }
    }
    for (let i = 0; i < 6; i++) {
      const x = (0.13 + i * 0.151) * width;
      const y = horizon - (10 + 5 * Math.sin(i * 1.4));
      halo(bg, x, y, width * 0.15, [[0, '#ffb9a81d'], [1, '#ffb9a800']], 0.08);
    }
    const moon = bg.createLinearGradient(moonX, moonY - moonRadius, moonX, moonY + moonRadius);
    moon.addColorStop(0, '#fff7d8');
    moon.addColorStop(0.6, '#ffedc0');
    moon.addColorStop(1, '#ffc6a8');
    ellipse(bg, moonX, moonY, moonRadius, moonRadius, moon);
    for (const [x, y, rx, ry] of [[-0.32, 0.17, 0.23, 0.17], [0.33, 0.36, 0.18, 0.1],
      [0.16, -0.37, 0.17, 0.13], [-0.42, -0.29, 0.11, 0.10], [-0.09, 0.57, 0.13, 0.10]]) {
      ellipse(bg, moonX + x * moonRadius, moonY + y * moonRadius,
        rx * moonRadius, ry * moonRadius, '#c9778036', x);
    }
    // Soft overlapping ridges frame the open water.
    for (let layer = 0; layer < 2; layer++) {
      bg.beginPath();
      bg.moveTo(0, horizon + 6);
      for (let i = 0; i <= 160; i++) {
        const t = i / 160;
        const ridge = 0.45 + 0.24 * Math.sin(11*t + layer) + 0.17 * Math.cos(22*t + 2*layer)
          + 0.07 * Math.sin(47*t + layer);
        bg.lineTo(width*t, horizon - height*(0.09 - layer*0.028)*ridge);
      }
      bg.lineTo(width, horizon + 6);
      bg.fillStyle = layer ? '#58445c' : '#70546b';
      bg.fill();
    }
    temple(width * 0.84, Math.min(width/620, height/490, 1.55));
    shore(1.8, '#3a2c4c', -1, height * 0.083);
    shore(0.8, '#27213e', 2, height * 0.066);
    shore(3.4, '#1b1a32', 6, height * 0.049);
    const pond = bg.createLinearGradient(0, horizon + 7, 0, height);
    pond.addColorStop(0, '#5a425c');
    pond.addColorStop(0.38, '#31344d');
    pond.addColorStop(0.77, '#192c42');
    pond.addColorStop(1, '#0e1b30');
    bg.fillStyle = pond;
    bg.fillRect(0, horizon + 7, width, height);
    halo(bg, moonX, horizon + 21, Math.min(width * 0.26, 140),
      [[0, '#f2a68d36'], [0.41, '#f7aaa320'], [1, '#f7aaa300']], 0.48);
    for (const [x, y, power] of shoreLights) {
      const lx = x * width;
      const ly = (y + 0.045) * height;
      halo(bg, lx, ly, 5 + power * 7, [[0, '#ffba7ca8'], [1, '#ffba7c00']]);
      ellipse(bg, lx, ly, 0.75 + power, 1.2 + power, '#ffd69c');
      halo(bg, lx, horizon + 12 + power * 4, 9 + power * 4,
        [[0, '#fb9e7b55'], [1, '#fb9e7b00']], 0.3);
    }
    const padSize = Math.min(width * 0.105, height * 0.083, 78);
    pads(width * 0.105, height * 0.859, padSize, -0.22, true);
    pads(width * 0.025, height * 0.904, padSize * 0.86, 0.23, false);
    pads(width * 0.20, height * 0.879, padSize * 0.61, 0.18, false);
    pads(width * 0.903, height * 0.811, padSize * 0.79, 0.3, true);
    pads(width * 0.978, height * 0.856, padSize * 1.08, -0.18, false);
    pads(width * 0.905, height * 0.914, padSize * 0.47, 0.26, false);
    const vignette = bg.createLinearGradient(0, 0, 0, height);
    vignette.addColorStop(0, '#080d261d');
    vignette.addColorStop(0.44, '#080d2600');
    vignette.addColorStop(0.87, '#080d2600');
    vignette.addColorStop(1, '#080d265d');
    bg.fillStyle = vignette;
    bg.fillRect(0, 0, width, height);
  }

  const vertices = [];
  const faces = [];
  function face(points, color, gloss = 0, doubleSided = false) {
    const a = vertices[points[0]];
    const b = vertices[points[1]].map((value, i) => value - a[i]);
    const c = vertices[points[2]].map((value, i) => value - a[i]);
    const normal = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2],
      b[0] * c[1] - b[1] * c[0]];
    const length = Math.hypot(...normal);
    if (length < 0.00001) return;
    faces.push({ points, normal: normal.map(value => value / length), color, gloss, doubleSided, depth: 0 });
  }
  function surface(rows, cols, position, material, options = {}) {
    const first = vertices.length;
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) vertices.push(position(row / rows, col / cols));
    }
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = first + row * (cols + 1) + col;
        const corners = [index, index + cols + 1, index + cols + 2, index + 1];
        const color = material((row + 0.5) / rows, (col + 0.5) / cols);
        face(options.flip ? corners.reverse() : corners, color, options.gloss, options.doubleSided);
      }
    }
  }
  function blend(a, b, t) {
    return a.map((value, index) => lerp(value, b[index], t));
  }
  function ring(profile, material, scallop = 0) {
    for (let i = 0; i < profile.length - 1; i++) {
      const [r1, y1] = profile[i];
      const [r2, y2] = profile[i + 1];
      surface(1, 48, (u, v) => {
        const angle = v * tau;
        const radius = lerp(r1, r2, u) + scallop * Math.cos(angle * 16);
        return [radius * Math.cos(angle), lerp(y1, y2, u), radius * Math.sin(angle)];
      }, (u, v) => material(i, v), { doubleSided: true, gloss: 0.07 });
    }
  }

  const greens = [[43, 103, 80], [82, 154, 104], [111, 178, 114], [67, 130, 92]];
  ring([[1.04, 0.015], [1.29, 0.09], [1.44, 0.24], [1.37, 0.38], [0.02, 0.39]],
    (row, v) => blend(greens[row], [183, 202, 134], 0.19 * (1 + Math.cos(v * tau * 16))), 0.027);
  ring([[1.34, 0.146], [1.43, 0.187], [1.45, 0.218]],
    (row, v) => blend([95, 143, 93], [189, 206, 124], 0.26 + 0.25 * Math.cos(v * tau * 16)));
  function petal(angle, spec) {
    const [start, end, baseY, tipY, breadth, cup, baseColor, tipColor] = spec;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    surface(7, 6, (u, v) => {
      const across = 2 * v - 1;
      const shape = Math.pow(Math.sin(u * Math.PI), 0.84);
      const length = lerp(start, end, u) - across * across * shape * 0.09;
      const side = across * (0.012 + breadth * shape * (0.75 + 0.4 * u));
      const y = lerp(baseY, tipY, Math.pow(u, 1.65)) - cup * Math.sin(u * Math.PI)
        + across * across * shape * cup * 1.25;
      return [length * cos - side * sin, y, length * sin + side * cos];
    }, (u, v) => {
      const edge = Math.pow(Math.abs(2 * v - 1), 3);
      const body = blend(baseColor, tipColor, fade(u));
      return blend(body, [255, 223, 214], edge * 0.16);
    }, { doubleSided: true, gloss: 0.18 });
  }

  for (let i = 0; i < 16; i++) {
    petal(i * tau / 16, [0.79, 1.55, 0.29, 0.59, 0.25, 0.12, [40, 120, 88], [137, 203, 132]]);
  }
  for (let i = 0; i < 11; i++) {
    petal((i + 0.28) * tau / 11, [0.27, 1.37, 0.43, 0.79 + 0.06 * Math.sin(i * 3),
      0.29, 0.13, [151, 51, 124], i % 2 ? [248, 137, 184] : [254, 166, 190]]);
  }
  for (let i = 0; i < 8; i++) {
    petal((i + 0.5) * tau / 8, [0.15, 0.99, 0.48, 1.01 + 0.05 * Math.cos(i * 4),
      0.225, 0.09, [180, 77, 145], i % 2 ? [255, 181, 192] : [255, 201, 205]]);
  }
  for (let i = 0; i < 8; i++) {
    petal(i * tau / 8, [0.1, 0.45, 0.53, 0.79, 0.10, 0.04, [213, 133, 76], [255, 205, 123]]);
  }
  ring([[0.16, 0.55], [0.16, 1.37], [0.15, 1.43], [0.01, 1.43]],
    (row, v) => blend([255, 192, 111], [255, 235, 165], row * 0.21 + (1 + Math.cos(v * tau)) * 0.07));
  ring([[0.025, 1.43], [0.02, 1.52], [0.004, 1.52]], () => [86, 48, 59]);

  function drawMesh(x, y, size, yaw, rocking, now) {
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const sinTilt = Math.sin(rocking);
    const cosTilt = Math.cos(rocking);
    const pitch = 0.405;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    function rotate([vx, vy, vz]) {
      const horizontal = vx * cy - vz * sy;
      const depth = vx * sy + vz * cy;
      const vertical = vy * cosTilt + horizontal * sinTilt;
      return [horizontal * cosTilt - vy * sinTilt, vertical * cp - depth * sp, depth * cp + vertical * sp];
    }
    function project(point) {
      const [horizontal, vertical, depth] = rotate(point);
      const factor = size * 8 / (8 - depth);
      return [x + horizontal * factor, y - vertical * factor, depth];
    }
    const points = vertices.map(project);
    for (const polygon of faces) {
      const [a, b, c, d] = polygon.points;
      polygon.depth = (points[a][2] + points[b][2] + points[c][2] + points[d][2]) / 4;
    }
    faces.sort((a, b) => a.depth - b.depth);
    ctx.lineWidth = 0.68;
    for (const polygon of faces) {
      const [nx, ny, nz] = rotate(polygon.normal);
      const light = -0.43 * nx + 0.80 * ny + 0.42 * nz;
      const lit = polygon.doubleSided ? Math.abs(light) : Math.max(0, light);
      const strength = 0.70 + 0.40 * lit;
      const shine = polygon.gloss * Math.pow(lit, 6);
      const r = Math.round(clamp(polygon.color[0] * strength + shine * 32, 0, 255));
      const g = Math.round(clamp(polygon.color[1] * strength + shine * 51, 0, 255));
      const b = Math.round(clamp(polygon.color[2] * (strength + 0.08) + shine * 35, 0, 255));
      const [a, second, c, d] = polygon.points;
      ctx.beginPath();
      ctx.moveTo(points[a][0], points[a][1]);
      ctx.lineTo(points[second][0], points[second][1]);
      ctx.lineTo(points[c][0], points[c][1]);
      ctx.lineTo(points[d][0], points[d][1]);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fill();
      ctx.stroke();
    }
    const [fx, fy] = project([0, 1.49, 0]);
    const sway = Math.sin(now * 5.6) * 0.11 + Math.sin(now * 8.9) * 0.046;
    const flutter = 1 + 0.15 * Math.sin(now * 9);
    halo(ctx, fx, fy - size * 0.22, size * 0.59,
      [[0, '#ffbd6d80'], [0.25, '#ffab625b'], [1, '#ffab6200']]);
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(size, size * flutter);
    const flame = ctx.createLinearGradient(0, 0, 0, -0.54);
    flame.addColorStop(0, '#ff8a68');
    flame.addColorStop(0.35, '#ffe39b');
    flame.addColorStop(1, '#ffcd88');
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-0.23, -0.055, -0.135, -0.28, sway, -0.56);
    ctx.bezierCurveTo(sway + 0.035, -0.31, 0.26, -0.085, 0, 0);
    ctx.fillStyle = flame;
    ctx.fill();
    ellipse(ctx, sway * 0.18, -0.13, 0.063, 0.113, '#fff5cc', sway);
    ctx.restore();
  }

  function waterMotion(now) {
    for (const [x, depth, phase, power] of water) {
      const y = horizon + 8 + Math.pow(depth, 1.65) * (height - horizon - 15);
      const shimmer = 0.5 + 0.5 * Math.sin(now * (0.68 + power) + phase * tau);
      const drift = Math.sin(now * 0.55 + phase * tau) * (2 + 6 * depth);
      const center = x * width + drift;
      const inMoon = Math.max(0, 1 - Math.abs(center - moonX) / (10 + depth * width * 0.2));
      const span = (0.6 + 16 * depth) * (0.55 + power);
      const color = inMoon > 0.23
        ? 'rgba(255,190,161,' + (0.10 + shimmer * inMoon * 0.38) + ')'
        : 'rgba(162,180,221,' + (0.07 + shimmer * 0.15) + ')';
      ellipse(ctx, center, y, span, 0.38 + depth * 0.65, color);
    }
    for (let i = 0; i < 37; i++) {
      const depth = i / 36;
      const drift = Math.sin(i * 2.5 + now * 1.4) * (3 + depth * 13);
      const y = horizon + 8 + depth * depth * (height - horizon) * 0.67;
      const span = (3.5 + 12.5 * depth) * (1 + 0.52 * Math.sin(i * 5.3 + now * 1.2));
      const alpha = (1 - depth * 0.76) * (0.13 + 0.13 * Math.sin(i * 3.1 + now * 2));
      ellipse(ctx, moonX + drift, y, span, 0.38 + depth * 0.75, 'rgba(255,205,169,' + alpha + ')');
    }
  }

  function sparkle(x, y, scale, color) {
    ctx.beginPath();
    ctx.moveTo(x, y - scale * 1.65);
    ctx.quadraticCurveTo(x + scale * 0.13, y - scale * 0.19, x + scale, y);
    ctx.quadraticCurveTo(x + scale * 0.13, y + scale * 0.19, x, y + scale * 1.65);
    ctx.quadraticCurveTo(x - scale * 0.13, y + scale * 0.19, x - scale, y);
    ctx.quadraticCurveTo(x - scale * 0.13, y - scale * 0.19, x, y - scale * 1.65);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function drawFireflies(now) {
    for (const [px, py, phase, power] of fireflies) {
      const x = px * width + Math.cos(now * 0.46 + phase) * (5 + power * 11);
      const y = py * height + Math.sin(now * 0.71 + phase) * (3 + power * 5);
      const alpha = (0.47 + 0.43 * Math.sin(now * 1.65 + phase)) * 0.74;
      ellipse(ctx, x, y, 3.3 + power, 3.3 + power, 'rgba(255,214,158,' + alpha * 0.15 + ')');
      if (power > 0.63) sparkle(x, y, 1.25 + power, 'rgba(255,226,170,' + alpha + ')');
      else ellipse(ctx, x, y, 0.77 + power, 0.77 + power, 'rgba(255,226,170,' + alpha + ')');
    }
  }

  function ringRipple(x, y, rx, opacity) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.27, 0, 0, tau);
    ctx.strokeStyle = 'rgba(232,178,198,' + opacity + ')';
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }
  function boatWater(x, y, size, now) {
    ellipse(ctx, x, y + size * 0.08, size * 1.67, size * 0.42, '#090d2069');
    halo(ctx, x, y + size * 0.38, size * 1.54,
      [[0, '#ffa8874d'], [0.4, '#ed83a731'], [1, '#ed83a700']], 0.35);
    for (let i = 0; i < 7; i++) {
      const shift = Math.sin(i * 2.8 + now * 3.8) * size * 0.15;
      ellipse(ctx, x + shift, y + size * (0.35 + 0.097 * i),
        size * (0.38 - 0.044 * i) * (1 + 0.48 * Math.cos(i * 4.3 + now)),
        Math.max(0.26, size * 0.012), 'rgba(255,171,156,' + (0.27 - 0.028 * i) + ')');
    }
    for (let i = 0; i < 3; i++) {
      const stage = (now * 0.47 + i / 3) % 1;
      ringRipple(x, y, size * (1.48 + stage * 1.56), (1 - stage) * 0.31);
    }
  }
  function boatX(progress) {
    return startX + lerp(width * float.offset, travelWidth * float.direction, ease(progress));
  }

  function boatY(progress) {
    return lerp(startY, height * 0.495, fade(progress));
  }

  function drawFireworks(age, fullSize) {
    const compact = landscape.matches;
    const scale = clamp(Math.min(width, height) * 0.148, 32, 115);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const burst of fireworks) {
      const time = age - burst.start;
      if (time < 0 || time > burst.climb + 1.9) continue;
      const across = float.direction > 0 ? burst.across : 1 - burst.across;
      const x = width * (compact ? lerp(0.48, 0.91, across) : lerp(0.14, 0.86, across));
      const y = height * burst.altitude;
      const radius = scale * burst.size;
      const [glow, , core] = burst.colors;
      if (time < burst.climb) {
        const launch = burst.start / floatDuration;
        const fromX = boatX(launch);
        const fromY = boatY(launch) - fullSize * lerp(1, 0.292, fade(launch)) * 1.9;
        const rise = time / burst.climb;
        const tail = Math.max(0, rise - 0.13);
        const headX = lerp(fromX, x, rise);
        const headY = lerp(fromY, y, ease(rise));
        const tailX = lerp(fromX, x, tail);
        const tailY = lerp(fromY, y, ease(tail));
        const trail = ctx.createLinearGradient(tailX, tailY, headX, headY);
        trail.addColorStop(0, glow + '00');
        trail.addColorStop(1, glow);
        ctx.globalAlpha = 0.76;
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();
        ellipse(ctx, headX, headY, 1.35, 1.35, core);
        continue;
      }

      const fall = time - burst.climb;
      ctx.globalAlpha = 0.65 * (1 - clamp(fall / 0.55, 0, 1));
      halo(ctx, x, y, radius * 0.52, [[0, glow + '6b'], [1, glow + '00']]);
      const strength = 1 - clamp(fall / 1.65, 0, 1);
      ctx.globalAlpha = strength * 0.7;
      halo(ctx, x, horizon + 16, radius * 1.27, [[0, glow + '36'], [1, glow + '00']], 0.21);
      const reach = 1 - Math.exp(-fall * 2.55);
      const trailAge = Math.max(0, fall - 0.14);
      const trailReach = 1 - Math.exp(-trailAge * 2.55);
      for (const spark of burst.sparks) {
        if (fall >= spark.life) continue;
        const px = x + spark.dx * radius * reach;
        const py = y + radius * (spark.dy * reach + fall * fall * 0.15);
        const twinkle = 0.8 + 0.2 * Math.sin(fall * 13 + spark.phase);
        const opacity = Math.pow(1 - fall / spark.life, 0.85) * twinkle;
        ctx.globalAlpha = opacity * 0.48;
        ctx.strokeStyle = spark.color;
        ctx.lineWidth = spark.size;
        ctx.beginPath();
        ctx.moveTo(x + spark.dx * radius * trailReach,
          y + radius * (spark.dy * trailReach + trailAge * trailAge * 0.15));
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.globalAlpha = opacity * 0.81;
        ellipse(ctx, px, py, spark.size, spark.size, spark.color);
        if (spark.size > 1.37) {
          ctx.globalAlpha = opacity * 0.17;
          const reflectionY = horizon + 13 + (y + radius - py) * 0.27;
          ellipse(ctx, px, reflectionY, spark.size * (2.5 + reach), 0.6, spark.color);
        }
      }
    }
    ctx.restore();
  }

  function render(time) {
    if (!width || !height) return;
    if (returnMotion) {
      const t = clamp((time - returnMotion.start) / 240, 0, 1);
      dragOffset = returnMotion.offset * (1 - ease(t));
      if (t === 1) returnMotion = null;
    }
    const now = motion.matches ? 0 : time / 1000;
    let progress = 0;
    let age = 0;
    let x = startX + dragOffset;
    let y = startY;
    const fullSize = clamp(Math.min(width * 0.123, height * 0.125), 29, 94);
    let size = fullSize;
    let yaw = 0.23 + Math.sin(now * 0.73) * 0.09 + dragOffset * 0.008;
    let rocking = Math.sin(now * 1.98) * 0.039 + dragOffset * 0.0024;
    if (float) {
      age = Math.max(0, (time - float.start) / 1000);
      progress = motion.matches || float.settled ? 1 : clamp(age / floatDuration, 0, 1);
      const travel = ease(progress);
      x = boatX(progress);
      y = boatY(progress);
      size = fullSize * lerp(1, 0.292, fade(progress));
      yaw += float.direction * travel * 0.94;
      rocking += float.direction * Math.sin(progress * Math.PI) * 0.13;
      if (progress === 1 && !float.settled) {
        float.settled = true;
        button.removeAttribute('aria-disabled');
        buttonLabel.textContent = 'Float another';
      }
    }
    if (!motion.matches) y += Math.sin(now * 2.05) * size * 0.045;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.drawImage(backdrop, 0, 0, width, height);
    waterMotion(now);
    drawFireflies(now);
    if (float && !float.settled) {
      const ripple = clamp(age / 1.8, 0, 1);
      ringRipple(boatX(0), startY, fullSize * (1.55 + ease(ripple) * 2.25), 0.41 * (1 - ripple));
      drawFireworks(age, fullSize);
    }
    boatWater(x, y, size, now);
    drawMesh(x, y, size, yaw, rocking, now);
  }

  function animate(time) {
    frame = null;
    if (time - lastDraw >= 30) {
      render(time);
      lastDraw = time;
    }
    schedule();
  }
  function schedule() {
    if (frame === null && !document.hidden && !motion.matches) frame = requestAnimationFrame(animate);
  }
  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    if (!width || !height) return;
    ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = backdrop.width = Math.max(1, Math.round(width * ratio));
    canvas.height = backdrop.height = Math.max(1, Math.round(height * ratio));
    horizon = height * 0.445;
    startX = width * (landscape.matches ? 0.68 : 0.5);
    startY = landscape.matches ? height * 0.79 : clamp(height * 0.69, horizon + 24, height - 160);
    travelWidth = width * (landscape.matches ? 0.18 : 0.293);
    moonX = width * 0.735;
    moonY = height * 0.245;
    moonRadius = Math.min(width * 0.062, height * 0.084, 70);
    paintBackdrop();
    render(performance.now());
    schedule();
  }

  function release(side) {
    if (float) return;
    gesture = null;
    direction = side;
    float = {direction: side, offset: width ? dragOffset / width : 0, start: performance.now()};
    dragOffset = 0;
    returnMotion = null;
    button.setAttribute('aria-disabled', 'true');
    buttonLabel.textContent = 'Floating away…';
    if (document.activeElement === wish) button.focus({preventScroll: true});
    wishField.hidden = true;
    sentWish.textContent = wish.value.trim();
    sentWish.hidden = !sentWish.textContent;
    hint.hidden = true;
    message.textContent = 'May your wish come true ✨';
    render(performance.now());
    schedule();
  }
  function next() {
    float = null;
    dragOffset = 0;
    returnMotion = null;
    buttonLabel.textContent = 'Float my krathong';
    wish.value = '';
    wishField.hidden = false;
    sentWish.hidden = true;
    sentWish.textContent = '';
    hint.hidden = false;
    message.textContent = '';
    render(performance.now());
    schedule();
  }

  actions.addEventListener('submit', event => {
    event.preventDefault();
    if (float?.settled) next();
    else if (!float) release(-direction);
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || gesture || float) return;
    returnMotion = null;
    gesture = {id: event.pointerId, startX: event.clientX, startY: event.clientY};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const delta = event.clientX - gesture.startX;
    dragOffset = clamp(delta * 0.45, -width * 0.18, width * 0.18);
    render(performance.now());
  });
  function endGesture(event, cancelled) {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    gesture = null;
    if (!cancelled && Math.abs(dx) >= 32 && Math.abs(dx) >= Math.abs(dy) * 1.15) {
      release(Math.sign(dx));
    } else if (motion.matches) {
      dragOffset = 0;
      render(performance.now());
    } else {
      returnMotion = {offset: dragOffset, start: performance.now()};
      schedule();
    }
  }
  canvas.addEventListener('pointerup', event => endGesture(event, false));
  canvas.addEventListener('pointercancel', event => endGesture(event, true));
  canvas.addEventListener('lostpointercapture', event => endGesture(event, true));
  motion.addEventListener('change', () => {
    if (motion.matches && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    render(performance.now());
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  new ResizeObserver(resize).observe(canvas);
  resize();
})();
