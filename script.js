(() => {
  const canvas = document.getElementById("triangle-field");
  const ctx = canvas.getContext("2d", {
    alpha: false,
    desynchronized: true
  });

  const TAU = Math.PI * 2;
  const BASE_CELL = 60;
  const MAX_COLS = 36;
  const MAX_ROWS = 22;
  const POINTER_RADIUS = 150;
  const MAX_FLIP = Math.PI * 0.92;
  const SPRING = 58;
  const DAMPING = 13.5;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let cellSize = BASE_CELL;
  let cols = 0;
  let rows = 0;
  let tiles = [];
  let staticCanvas = document.createElement("canvas");
  let staticCtx = staticCanvas.getContext("2d", { alpha: false });
  let rafId = 0;
  let lastFrame = 0;

  const activeTiles = new Set();

  const pointer = {
    active: false,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    time: 0,
    glow: 0
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;

  function addQuad(tris, x, y, w, h, tone = 0) {
    tris.push(
      { p: [x, y, x + w, y, x, y + h], tone },
      { p: [x + w, y, x + w, y + h, x, y + h], tone: tone + 0.12 }
    );
  }

  function addSlash(tris, x1, y1, x2, y2, thickness, tone = 0) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const nx = (-dy / length) * thickness * 0.5;
    const ny = (dx / length) * thickness * 0.5;

    tris.push(
      {
        p: [
          x1 + nx,
          y1 + ny,
          x2 + nx,
          y2 + ny,
          x1 - nx,
          y1 - ny
        ],
        tone
      },
      {
        p: [
          x2 + nx,
          y2 + ny,
          x2 - nx,
          y2 - ny,
          x1 - nx,
          y1 - ny
        ],
        tone: tone + 0.12
      }
    );
  }

  function makeTemplates() {
    const z = [];
    addQuad(z, 0.13, 0.14, 0.74, 0.15, 0.08);
    addSlash(z, 0.77, 0.22, 0.23, 0.78, 0.18, 0.28);
    addQuad(z, 0.13, 0.71, 0.74, 0.15, -0.02);

    const r = [];
    addQuad(r, 0.14, 0.13, 0.16, 0.74, -0.04);
    addQuad(r, 0.26, 0.13, 0.42, 0.14, 0.14);
    addQuad(r, 0.26, 0.43, 0.4, 0.14, 0.04);
    addQuad(r, 0.62, 0.2, 0.16, 0.28, 0.22);
    addSlash(r, 0.34, 0.54, 0.78, 0.86, 0.15, 0.36);

    return { Z: z, R: r };
  }

  const templates = makeTemplates();

  function hash2(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function createTile(col, row) {
    const x = col * cellSize;
    const y = row * cellSize;
    const char = col % 2 === 0 ? "Z" : "R";
    const warm = (Math.floor(col / 2) + row) % 2 === 0;
    const seed = hash2(col + 4.2, row + 8.7);

    return {
      col,
      row,
      index: row * cols + col,
      x,
      y,
      cx: x + cellSize * 0.5,
      cy: y + cellSize * 0.5,
      char,
      warm,
      rotation: 0,
      velocity: 0,
      target: 0,
      phase: seed * TAU,
      inertia: lerp(0.82, 1.24, seed)
    };
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, width * height > 2500000 ? 1.2 : 1.35);

    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    staticCanvas.width = canvas.width;
    staticCanvas.height = canvas.height;
    staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cellSize = Math.max(
      BASE_CELL,
      Math.ceil(Math.max(width / MAX_COLS, height / MAX_ROWS))
    );
    cols = Math.ceil(width / cellSize) + 1;
    rows = Math.ceil(height / cellSize) + 1;

    tiles = [];
    activeTiles.clear();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        tiles.push(createTile(col, row));
      }
    }

    renderStaticLayer();
    drawFrame();
  }

  function background(context) {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#050507");
    gradient.addColorStop(0.48, "#101219");
    gradient.addColorStop(1, "#040405");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const wash = context.createRadialGradient(
      width * 0.2,
      height * 0.18,
      0,
      width * 0.2,
      height * 0.18,
      Math.max(width, height) * 0.65
    );
    wash.addColorStop(0, "rgba(255, 66, 104, 0.12)");
    wash.addColorStop(0.48, "rgba(33, 225, 205, 0.055)");
    wash.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = wash;
    context.fillRect(0, 0, width, height);
  }

  function renderStaticLayer() {
    staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    background(staticCtx);

    for (const tile of tiles) {
      drawTile(staticCtx, tile, 0, false);
    }
  }

  function tilePlate(context, tile, alpha = 0.94) {
    context.fillStyle = `rgba(7, 8, 11, ${alpha})`;
    context.fillRect(tile.x, tile.y, cellSize, cellSize);
  }

  function colorFor(tile, triangle, rotation, back) {
    const a = tile.warm ? [255, 68, 108] : [40, 226, 207];
    const b = tile.warm ? [255, 202, 83] : [116, 140, 255];
    const mix = clamp(0.45 + triangle.tone + Math.abs(Math.sin(rotation)) * 0.18, 0, 1);
    const light = back ? 0.42 : 0.86 + Math.abs(Math.sin(rotation)) * 0.16;
    const r = Math.round(lerp(a[0], b[0], mix) * light);
    const g = Math.round(lerp(a[1], b[1], mix) * light);
    const blue = Math.round(lerp(a[2], b[2], mix) * light);

    return `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(blue, 0, 255)})`;
  }

  function project(tile, px, py, rotation) {
    const size = cellSize * 0.76;
    const originX = tile.x + cellSize * 0.12;
    const originY = tile.y + cellSize * 0.12;
    const cx = originX + size * 0.5;
    const localX = originX + px * size;
    const localY = originY + py * size;
    let scaleX = Math.cos(rotation);

    if (Math.abs(scaleX) < 0.045) {
      scaleX = scaleX < 0 ? -0.045 : 0.045;
    }

    const perspective = Math.sin(rotation);
    return {
      x: cx + (localX - cx) * scaleX + perspective * (py - 0.5) * cellSize * 0.12,
      y: localY - perspective * (px - 0.5) * cellSize * 0.1
    };
  }

  function drawTile(context, tile, rotation, active) {
    const template = templates[tile.char];
    const back = Math.cos(rotation) < 0;
    const flipAmount = Math.abs(Math.sin(rotation));

    if (active && flipAmount > 0.03) {
      context.fillStyle = `rgba(0, 0, 0, ${0.16 + flipAmount * 0.28})`;
      context.fillRect(
        tile.x + cellSize * 0.18 + flipAmount * 7,
        tile.y + cellSize * 0.2 + flipAmount * 5,
        cellSize * 0.64,
        cellSize * 0.62
      );
    }

    for (let i = 0; i < template.length; i += 1) {
      const triangle = template[i];
      const p = triangle.p;
      const a = project(tile, p[0], p[1], rotation);
      const b = project(tile, p[2], p[3], rotation);
      const c = project(tile, p[4], p[5], rotation);

      context.fillStyle = colorFor(tile, triangle, rotation, back);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.lineTo(c.x, c.y);
      context.closePath();
      context.fill();
    }

    if (active && flipAmount > 0.24) {
      context.fillStyle = `rgba(0, 0, 0, ${0.08 + flipAmount * 0.1})`;
      context.fillRect(
        tile.cx - cellSize * 0.018,
        tile.y + cellSize * 0.18,
        cellSize * 0.036,
        cellSize * 0.64
      );
    }
  }

  function activateTile(tile, target, velocity) {
    tile.target = Math.abs(target) > Math.abs(tile.target) ? target : tile.target;
    tile.velocity += velocity;
    activeTiles.add(tile);
  }

  function disturbAt(x, y, vx, vy, speed) {
    const radius = POINTER_RADIUS;
    const colStart = clamp(Math.floor((x - radius) / cellSize), 0, cols - 1);
    const colEnd = clamp(Math.ceil((x + radius) / cellSize), 0, cols - 1);
    const rowStart = clamp(Math.floor((y - radius) / cellSize), 0, rows - 1);
    const rowEnd = clamp(Math.ceil((y + radius) / cellSize), 0, rows - 1);
    const length = Math.hypot(vx, vy);
    const nx = length > 1 ? vx / length : 1;
    const ny = length > 1 ? vy / length : 0;
    const speedBoost = clamp(speed / 900, 0, 1.65);

    for (let row = rowStart; row <= rowEnd; row += 1) {
      for (let col = colStart; col <= colEnd; col += 1) {
        const tile = tiles[row * cols + col];
        const dx = tile.cx - x;
        const dy = tile.cy - y;
        const distance = Math.hypot(dx, dy);

        if (distance > radius) {
          continue;
        }

        const falloff = Math.pow(1 - distance / radius, 2.25);
        const directional = clamp((dx * nx + dy * ny) / radius, -0.32, 1);
        const sign = length > 1 ? Math.sign(vx || nx || 1) : col % 2 === 0 ? 1 : -1;
        const strength = falloff * (0.84 + directional * 0.36) * (0.92 + speedBoost);
        const target = clamp(sign * strength * MAX_FLIP, -MAX_FLIP, MAX_FLIP);

        activateTile(tile, target, sign * strength * 4.8);
      }
    }

    requestTick();
  }

  function pointerMove(event) {
    const now = performance.now();
    const x = event.clientX;
    const y = event.clientY;

    if (!pointer.active) {
      pointer.active = true;
      pointer.x = x;
      pointer.y = y;
      pointer.px = x;
      pointer.py = y;
      pointer.vx = 0;
      pointer.vy = 0;
      pointer.speed = 0;
      pointer.time = now;
      pointer.glow = 1;
      disturbAt(x, y, 1, 0, 280);
      return;
    }

    const dt = Math.max((now - pointer.time) / 1000, 0.012);
    const rawVx = (x - pointer.x) / dt;
    const rawVy = (y - pointer.y) / dt;

    pointer.px = pointer.x;
    pointer.py = pointer.y;
    pointer.x = x;
    pointer.y = y;
    pointer.vx = lerp(pointer.vx, rawVx, 0.55);
    pointer.vy = lerp(pointer.vy, rawVy, 0.55);
    pointer.speed = Math.hypot(pointer.vx, pointer.vy);
    pointer.time = now;
    pointer.glow = 1;

    disturbAt(x, y, pointer.vx, pointer.vy, Math.max(pointer.speed, 260));
  }

  function pointerLeave() {
    pointer.active = false;
    pointer.glow = 0;
  }

  function update(dt) {
    pointer.glow *= Math.pow(0.08, dt);

    for (const tile of Array.from(activeTiles)) {
      // The mouse writes a temporary flip target directly into nearby cells.
      // A damped spring chases that target, then both target and velocity decay
      // so the Z/R block visibly flips and settles back to the cached front.
      tile.target *= Math.pow(0.018, dt);
      const acceleration = ((tile.target - tile.rotation) * SPRING - tile.velocity * DAMPING) / tile.inertia;
      tile.velocity += acceleration * dt;
      tile.rotation += tile.velocity * dt;

      if (
        Math.abs(tile.rotation) < 0.006 &&
        Math.abs(tile.velocity) < 0.025 &&
        Math.abs(tile.target) < 0.006
      ) {
        tile.rotation = 0;
        tile.velocity = 0;
        tile.target = 0;
        activeTiles.delete(tile);
      }
    }
  }

  function drawPointerGlow() {
    if (pointer.glow < 0.02) {
      return;
    }

    const radius = POINTER_RADIUS * 0.72;
    const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius);
    glow.addColorStop(0, `rgba(255, 255, 255, ${0.12 * pointer.glow})`);
    glow.addColorStop(0.34, `rgba(255, 70, 106, ${0.07 * pointer.glow})`);
    glow.addColorStop(0.72, `rgba(40, 226, 207, ${0.045 * pointer.glow})`);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(pointer.x - radius, pointer.y - radius, radius * 2, radius * 2);
  }

  function drawFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(staticCanvas, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (const tile of activeTiles) {
      tilePlate(ctx, tile);
      drawTile(ctx, tile, tile.rotation, true);
    }

    drawPointerGlow();
  }

  function requestTick() {
    if (!rafId) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    rafId = 0;

    if (!lastFrame) {
      lastFrame = now;
    }

    const dt = clamp((now - lastFrame) / 1000, 0.001, 0.033);
    lastFrame = now;

    update(dt);
    drawFrame();

    if (activeTiles.size > 0 || pointer.glow > 0.02) {
      requestTick();
    }
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", pointerMove, { passive: true });
  window.addEventListener("pointerleave", pointerLeave);
  window.addEventListener("blur", pointerLeave);
  window.addEventListener("beforeunload", () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  });

  resize();
})();
