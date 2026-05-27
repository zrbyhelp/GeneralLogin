<template>
  <div class="portal-field" aria-hidden="true">
    <canvas ref="canvasRef" class="portal-field__canvas" aria-hidden="true"></canvas>
  </div>
  <div class="portal-field__controls" aria-label="Color controls">
    <div class="portal-field__palette" role="tablist" aria-label="Palette chooser">
      <button
        v-for="(theme, index) in themeCount"
        :key="index"
        class="portal-field__swatch"
        :class="{ active: themeIndex === index }"
        type="button"
        :data-theme="index"
        :aria-label="`Palette ${index + 1}`"
        @click.stop="applyTheme(index)"
      />
    </div>
    <button class="portal-field__jump" type="button" aria-label="Jump" @click.stop="startJumpTransition">
      ↗
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

const canvasRef = ref<HTMLCanvasElement | null>(null);
const themeCount = 5;
const themeIndex = ref(0);
let cleanup: (() => void) | undefined;
let applyThemeImpl: (index: number) => void = () => {};
let startJumpTransitionImpl: () => void = () => {};

function applyTheme(index: number) {
  applyThemeImpl(index);
}

function startJumpTransition() {
  startJumpTransitionImpl();
}

onMounted(async () => {
  await nextTick();
  let canvas = canvasRef.value;
  if (!canvas) {
    await new Promise(requestAnimationFrame);
    canvas = canvasRef.value;
  }

  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d", {
    alpha: true,
    desynchronized: true
  });

  if (!ctx) {
    return;
  }

  const canvasEl = canvas;
  const ctx2d = ctx;

  themeIndex.value = Math.floor(Math.random() * themeCount);

  const TAU = Math.PI * 2;
  const BASE_CELL = 60;
  const MAX_COLS = 36;
  const MAX_ROWS = 22;
  const POINTER_RADIUS = 150;
  const MAX_FLIP = Math.PI * 0.92;
  const TRANSITION_SPINS = 2.75;
  const TRANSITION_ROTATION = TAU * TRANSITION_SPINS;
  const SPRING = 58;
  const DAMPING = 13.5;
  const THEME_PRESETS = [
    {
      brightnessBase: 0.34,
      brightnessRange: 0.12,
      palettes: [
        [[42, 45, 54], [246, 241, 232]],
        [[22, 28, 42], [122, 161, 255]],
        [[34, 30, 22], [246, 211, 141]],
        [[26, 28, 31], [146, 228, 213]]
      ]
    },
    {
      brightnessBase: 0.36,
      brightnessRange: 0.12,
      palettes: [
        [[30, 42, 58], [142, 180, 255]],
        [[26, 45, 41], [184, 247, 212]],
        [[36, 36, 42], [246, 241, 232]],
        [[38, 28, 38], [214, 163, 255]]
      ]
    },
    {
      brightnessBase: 0.35,
      brightnessRange: 0.12,
      palettes: [
        [[42, 31, 25], [246, 211, 141]],
        [[38, 28, 32], [245, 170, 185]],
        [[29, 34, 44], [146, 183, 255]],
        [[36, 36, 36], [246, 241, 232]]
      ]
    },
    {
      brightnessBase: 0.33,
      brightnessRange: 0.12,
      palettes: [
        [[35, 29, 44], [180, 148, 255]],
        [[36, 32, 24], [246, 211, 141]],
        [[24, 36, 42], [129, 211, 231]],
        [[30, 40, 35], [151, 237, 188]]
      ]
    },
    {
      brightnessBase: 0.34,
      brightnessRange: 0.12,
      palettes: [
        [[28, 42, 35], [151, 237, 188]],
        [[42, 34, 25], [246, 211, 141]],
        [[34, 31, 44], [188, 164, 255]],
        [[28, 36, 44], [188, 220, 255]]
      ]
    }
  ];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let cellSize = BASE_CELL;
  let cols = 0;
  let rows = 0;
  let tiles: any[] = [];
  const staticCanvas = document.createElement("canvas");
  const staticCtx = staticCanvas.getContext("2d", { alpha: true });
  const activeTiles = new Set<any>();
  let rafId = 0;
  let lastFrame = 0;
  let jumpState: any = null;
  let introPending = true;
  let introState: any = null;

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

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  function addQuad(tris: any[], x: number, y: number, w: number, h: number, tone = 0) {
    tris.push(
      { p: [x, y, x + w, y, x, y + h], tone },
      { p: [x + w, y, x + w, y + h, x, y + h], tone: tone + 0.12 }
    );
  }

  function addSlash(
    tris: any[],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    thickness: number,
    tone = 0
  ) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const nx = (-dy / length) * thickness * 0.5;
    const ny = (dx / length) * thickness * 0.5;

    tris.push(
      { p: [x1 + nx, y1 + ny, x2 + nx, y2 + ny, x1 - nx, y1 - ny], tone },
      {
        p: [x2 + nx, y2 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny],
        tone: tone + 0.12
      }
    );
  }

  function makeTemplates() {
    const z: any[] = [];
    addQuad(z, 0.04, 0.08, 0.92, 0.18, 0.08);
    addSlash(z, 0.86, 0.17, 0.14, 0.83, 0.2, 0.28);
    addQuad(z, 0.04, 0.74, 0.92, 0.18, -0.02);

    const r: any[] = [];
    addQuad(r, 0.05, 0.08, 0.19, 0.84, -0.04);
    addQuad(r, 0.2, 0.08, 0.54, 0.17, 0.14);
    addQuad(r, 0.2, 0.43, 0.52, 0.16, 0.04);
    addQuad(r, 0.68, 0.18, 0.2, 0.31, 0.22);
    addSlash(r, 0.25, 0.55, 0.88, 0.91, 0.17, 0.36);

    return { Z: z, R: r };
  }

  const templates = makeTemplates();

  function hash2(x: number, y: number) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function createTile(col: number, row: number) {
    const x = col * cellSize;
    const y = row * cellSize;
    const char = col % 2 === 0 ? "Z" : "R";
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
      hidden: false,
      transition: "",
      opacity: 1,
      paletteSeed: hash2(col * 2.17 + 8.5, row * 3.41 + 1.6),
      brightnessSeed: hash2(col * 4.9, row * 6.3),
      triangleSeed: hash2(col * 12.9 + 1.1, row * 9.7 + 2.4),
      paletteA: [255, 72, 112],
      paletteB: [255, 214, 86],
      brightness: 1,
      rotation: 0,
      velocity: 0,
      target: 0,
      phase: seed * TAU,
      inertia: lerp(0.82, 1.24, seed)
    };
  }

  function colorFor(tile: any, triangle: any, rotation: number, back: boolean, index: number) {
    const a = tile.paletteA;
    const b = tile.paletteB;
    const facetSeed = hash2(
      tile.triangleSeed * 23.7 + index * 5.1,
      tile.phase * 0.31 + index * 9.4
    );
    const hueSeed = hash2(tile.col * 4.6 + index * 1.7, tile.row * 6.2 + index * 2.9);
    const mix = clamp(
      0.45 + triangle.tone + (facetSeed - 0.5) * 0.16 + Math.abs(Math.sin(rotation)) * 0.18,
      0,
      1
    );
    const facetLight = 0.92 + facetSeed * 0.16;
    const light =
      (back ? 0.52 : 0.98 + Math.abs(Math.sin(rotation)) * 0.18) *
      tile.brightness *
      facetLight;
    const channelShift = (hueSeed - 0.5) * 14;
    const r = Math.round(lerp(a[0], b[0], mix) * light + channelShift);
    const g = Math.round(lerp(a[1], b[1], mix) * light - channelShift * 0.45);
    const blue = Math.round(lerp(a[2], b[2], mix) * light + (facetSeed - 0.5) * 12);

    return `rgb(${clamp(r, 0, 255)}, ${clamp(g, 0, 255)}, ${clamp(blue, 0, 255)})`;
  }

  function project(tile: any, px: number, py: number, rotation: number) {
    const size = cellSize * 0.94;
    const originX = tile.x + cellSize * 0.03;
    const originY = tile.y + cellSize * 0.03;
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

  function drawTile(context: CanvasRenderingContext2D, tile: any, rotation: number, active: boolean) {
    const template = templates[tile.char as "Z" | "R"];
    const back = Math.cos(rotation) < 0;
    let transitionAlpha = 1;

    if (tile.transition === "hide" || tile.transition === "show") {
      transitionAlpha = clamp(1 - Math.abs(rotation) / TRANSITION_ROTATION, 0, 1);
    }

    if (transitionAlpha <= 0.01) {
      return;
    }

    context.save();
    context.globalAlpha *= transitionAlpha * tile.opacity;

    for (let i = 0; i < template.length; i += 1) {
      const triangle = template[i];
      const p = triangle.p;
      const a = project(tile, p[0], p[1], rotation);
      const b = project(tile, p[2], p[3], rotation);
      const c = project(tile, p[4], p[5], rotation);

      context.fillStyle = colorFor(tile, triangle, rotation, back, i);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.lineTo(c.x, c.y);
      context.closePath();
      context.fill();
    }

    context.restore();
  }

  function clearTile(context: CanvasRenderingContext2D, tile: any) {
    context.clearRect(tile.x - 1, tile.y - 1, cellSize + 2, cellSize + 2);
  }

  function setTheme(nextThemeIndex: number, shouldRender = true) {
    themeIndex.value = (nextThemeIndex + THEME_PRESETS.length) % THEME_PRESETS.length;
    const theme = THEME_PRESETS[themeIndex.value];

    for (const tile of tiles) {
      const paletteIndex = Math.floor(tile.paletteSeed * theme.palettes.length) % theme.palettes.length;
      const palette = theme.palettes[paletteIndex];
      tile.paletteA = palette[0];
      tile.paletteB = palette[1];
      tile.brightness = theme.brightnessBase + tile.brightnessSeed * theme.brightnessRange;
    }

    if (shouldRender) {
      renderStaticLayer();
      drawFrame();
    }
  }

  function renderStaticLayer() {
    if (!staticCtx) {
      return;
    }

    staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    staticCtx.clearRect(0, 0, width, height);

    for (const tile of tiles) {
      if (!tile.hidden) {
        drawTile(staticCtx, tile, 0, false);
      }
    }
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, width * height > 2500000 ? 1.2 : 1.35);

    canvasEl.width = Math.ceil(width * dpr);
    canvasEl.height = Math.ceil(height * dpr);
    canvasEl.style.width = `${width}px`;
    canvasEl.style.height = `${height}px`;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    staticCanvas.width = canvasEl.width;
    staticCanvas.height = canvasEl.height;
    staticCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);

    cellSize = Math.max(BASE_CELL, Math.ceil(Math.max(width / MAX_COLS, height / MAX_ROWS)));
    cols = Math.ceil(width / cellSize) + 1;
    rows = Math.ceil(height / cellSize) + 1;

    tiles = [];
    activeTiles.clear();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        tiles.push(createTile(col, row));
      }
    }

    setTheme(themeIndex.value, false);
    renderStaticLayer();
    drawFrame();
  }

  function visibleTileCount() {
    let count = 0;
    for (const tile of tiles) {
      if (!tile.hidden) {
        count += 1;
      }
    }
    return count;
  }

  function startTileExit(tile: any) {
    if (tile.hidden) {
      return;
    }
    tile.transition = "hide";
    tile.rotation = 0;
    tile.velocity = 0;
    tile.target = TRANSITION_ROTATION;
    tile.opacity = 1;
    activeTiles.add(tile);
  }

  function startTileEnter(tile: any) {
    if (!tile.hidden) {
      return;
    }
    tile.hidden = false;
    tile.transition = "show";
    tile.rotation = TRANSITION_ROTATION;
    tile.velocity = 0;
    tile.target = 0;
    tile.opacity = 1;
    activeTiles.add(tile);
  }

  function buildJumpQueue(mode: "hide" | "show") {
    const queue = tiles.filter((tile) => (mode === "hide" ? !tile.hidden : tile.hidden));

    queue.sort((a, b) => {
      if (mode === "hide") {
        return b.row + b.col - (a.row + a.col) || b.col - a.col;
      }
      return a.row + a.col - (b.row + b.col) || a.col - b.col;
    });

    return queue;
  }

  function runJumpTransition() {
    if (jumpState) {
      return;
    }

    introState = null;
    introPending = false;
    pointer.active = false;
    pointer.glow = 0;

    for (const tile of activeTiles) {
      if (!tile.transition) {
        tile.rotation = 0;
        tile.velocity = 0;
        tile.target = 0;
      }
    }
    activeTiles.clear();

    const mode = visibleTileCount() > 0 ? "hide" : "show";
    const queue = buildJumpQueue(mode);

    jumpState = {
      mode,
      queue,
      nextAt: performance.now(),
      interval: 5
    };

    requestTick();
  }

  function startIntroTransition() {
    if (!introPending || introState || jumpState) {
      return;
    }

    const queue = tiles.slice().sort((a, b) => a.row + a.col - (b.row + b.col) || a.col - b.col);

    for (const tile of tiles) {
      tile.hidden = true;
      tile.transition = "";
      tile.rotation = 0;
      tile.velocity = 0;
      tile.target = 0;
    }

    staticCtx?.clearRect(0, 0, width, height);
    activeTiles.clear();

    introState = {
      queue,
      nextAt: performance.now() + 160,
      interval: 8
    };

    requestTick();
  }

  function processJumpQueue(now: number) {
    if (!jumpState) {
      return;
    }

    while (jumpState.queue.length && now >= jumpState.nextAt) {
      const tile = jumpState.queue.shift();
      if (jumpState.mode === "hide") {
        startTileExit(tile);
      } else {
        startTileEnter(tile);
      }
      jumpState.nextAt += jumpState.interval;
    }

    if (!jumpState.queue.length && activeTiles.size === 0) {
      jumpState = null;
    }
  }

  function processIntroQueue(now: number) {
    if (!introState) {
      return;
    }

    while (introState.queue.length && now >= introState.nextAt) {
      const tile = introState.queue.shift();
      startTileEnter(tile);
      introState.nextAt += introState.interval;
    }

    if (!introState.queue.length && activeTiles.size === 0) {
      introState = null;
      introPending = false;
    }
  }

  function activateTile(tile: any, target: number, velocity: number) {
    if (tile.hidden || tile.transition) {
      return;
    }

    tile.target = Math.abs(target) > Math.abs(tile.target) ? target : tile.target;
    tile.velocity += velocity;
    activeTiles.add(tile);
  }

  function disturbAt(x: number, y: number, vx: number, vy: number, speed: number) {
    if (jumpState) {
      return;
    }

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

  function pointerMove(event: PointerEvent) {
    if (jumpState) {
      return;
    }

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

  function update(dt: number, now: number) {
    processIntroQueue(now);
    processJumpQueue(now);
    pointer.glow *= Math.pow(0.08, dt);

    for (const tile of Array.from(activeTiles)) {
      if (!tile.transition) {
        tile.target *= Math.pow(0.018, dt);
      }

      const acceleration = ((tile.target - tile.rotation) * SPRING - tile.velocity * DAMPING) / tile.inertia;
      tile.velocity += acceleration * dt;
      tile.rotation += tile.velocity * dt;

      if (tile.transition === "hide") {
        const alpha = clamp(1 - Math.abs(tile.rotation) / TRANSITION_ROTATION, 0, 1);
        if (alpha < 0.045 || Math.abs(tile.rotation) > TRANSITION_ROTATION * 0.98) {
          tile.hidden = true;
          tile.transition = "";
          tile.rotation = 0;
          tile.velocity = 0;
          tile.target = 0;
          activeTiles.delete(tile);
          clearTile(staticCtx!, tile);
          continue;
        }
      }

      if (tile.transition === "show") {
        const alpha = clamp(1 - Math.abs(tile.rotation) / TRANSITION_ROTATION, 0, 1);
        if (alpha > 0.985 && Math.abs(tile.velocity) < 0.12) {
          tile.transition = "";
          tile.rotation = 0;
          tile.velocity = 0;
          tile.target = 0;
          activeTiles.delete(tile);
          drawTile(staticCtx!, tile, 0, false);
          continue;
        }
      }

      if (
        !tile.transition &&
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
    const glow = ctx2d.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius);
    glow.addColorStop(0, `rgba(246, 241, 232, ${0.1 * pointer.glow})`);
    glow.addColorStop(0.34, `rgba(143, 180, 255, ${0.055 * pointer.glow})`);
    glow.addColorStop(0.72, `rgba(246, 211, 141, ${0.035 * pointer.glow})`);
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx2d.fillStyle = glow;
    ctx2d.fillRect(pointer.x - radius, pointer.y - radius, radius * 2, radius * 2);
  }

  function drawFrame() {
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx2d.drawImage(staticCanvas, 0, 0);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (const tile of activeTiles) {
      clearTile(ctx2d, tile);
      drawTile(ctx2d, tile, tile.rotation, true);
    }

    drawPointerGlow();
  }

  function requestTick() {
    if (!rafId) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function tick(now: number) {
    rafId = 0;

    if (!lastFrame) {
      lastFrame = now;
    }

    const dt = clamp((now - lastFrame) / 1000, 0.001, 0.033);
    lastFrame = now;

    update(dt, now);
    drawFrame();

    if (introState || jumpState || activeTiles.size > 0 || pointer.glow > 0.02) {
      requestTick();
    }
  }

  const onResize = () => resize();
  const onPointerMove = (event: PointerEvent) => pointerMove(event);
  const onPointerLeave = () => pointerLeave();

  applyThemeImpl = (index: number) => setTheme(index);
  startJumpTransitionImpl = runJumpTransition;

  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("blur", onPointerLeave);

  resize();
  startIntroTransition();

  cleanup = () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("blur", onPointerLeave);
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  };
});

onBeforeUnmount(() => {
  cleanup?.();
});
</script>

<style scoped>
.portal-field {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.portal-field__canvas {
  position: fixed;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100vw;
  height: 100vh;
  opacity: 0.42;
  pointer-events: none;
  touch-action: none;
}

.portal-field__controls {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
}

.portal-field__palette {
  display: flex;
  gap: 8px;
}

.portal-field__swatch,
.portal-field__jump {
  border: 1px solid rgba(246, 241, 232, 0.18);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.32) inset,
    0 8px 20px rgba(0, 0, 0, 0.24);
}

.portal-field__swatch {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  padding: 0;
  cursor: pointer;
}

.portal-field__swatch:nth-child(1) {
  background: linear-gradient(135deg, #2a2d36, #f6f1e8);
}

.portal-field__swatch:nth-child(2) {
  background: linear-gradient(135deg, #1e2a3a, #8eb4ff);
}

.portal-field__swatch:nth-child(3) {
  background: linear-gradient(135deg, #2a1f19, #f6d38d);
}

.portal-field__swatch:nth-child(4) {
  background: linear-gradient(135deg, #231d2c, #b494ff);
}

.portal-field__swatch:nth-child(5) {
  background: linear-gradient(135deg, #1c2a23, #97edbc);
}

.portal-field__swatch.active {
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.84),
    0 0 0 3px rgba(0, 0, 0, 0.18),
    0 0 12px rgba(255, 255, 255, 0.12);
}

.portal-field__jump {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(246, 241, 232, 0.12);
  color: #f6f1e8;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.portal-field__jump:active,
.portal-field__swatch:active {
  transform: translateY(1px);
}
</style>
