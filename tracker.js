/* ─────────────────────────────────────────────────────────────
   ALIEN / motion tracker — top-down station map background
   ───────────────────────────────────────────────────────────── */
function __initTracker() {
  'use strict';

  const canvas = document.getElementById('tracker-canvas');
  if (!canvas) { console.error('[tracker] no canvas'); return; }
  const ctx = canvas.getContext('2d');
  if (!ctx) { console.error('[tracker] no 2d context'); return; }

  let W = 0, H = 0;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const CELL = 28;
  let cols = 0, rows = 0, grid = null;

  function walkable(x, y) {
    if (x < 0 || y < 0 || x >= cols || y >= rows || !grid) return false;
    return grid[y * cols + x] === 0;
  }

  function buildGrid() {
    cols = Math.max(20, Math.ceil(window.innerWidth  / CELL) + 2);
    rows = Math.max(15, Math.ceil(window.innerHeight / CELL) + 2);
    grid = new Uint8Array(cols * rows);
    grid.fill(1);

    const roomCount = Math.max(10, Math.floor(cols * rows / 60));
    const rooms = [];
    for (let i = 0; i < roomCount; i++) {
      const rw = 3 + Math.floor(Math.random() * 6);
      const rh = 3 + Math.floor(Math.random() * 5);
      const maxX = Math.max(1, cols - rw - 2);
      const maxY = Math.max(1, rows - rh - 2);
      const rx = 1 + Math.floor(Math.random() * maxX);
      const ry = 1 + Math.floor(Math.random() * maxY);
      rooms.push({ cx: rx + (rw>>1), cy: ry + (rh>>1) });
      for (let y = ry; y < Math.min(rows - 1, ry + rh); y++)
        for (let x = rx; x < Math.min(cols - 1, rx + rw); x++)
          grid[y * cols + x] = 0;
    }
    // connect each room to next via L-corridors
    for (let i = 0; i < rooms.length - 1; i++) {
      const a = rooms[i], b = rooms[i + 1];
      let x = a.cx, y = a.cy;
      let safety = cols + rows;
      while (x !== b.cx && safety-- > 0) {
        if (y >= 0 && y < rows && x >= 0 && x < cols) grid[y * cols + x] = 0;
        x += x < b.cx ? 1 : -1;
      }
      safety = cols + rows;
      while (y !== b.cy && safety-- > 0) {
        if (y >= 0 && y < rows && x >= 0 && x < cols) grid[y * cols + x] = 0;
        y += y < b.cy ? 1 : -1;
      }
    }
    // perimeter ring
    for (let x = 2; x < cols - 2; x++) {
      grid[2 * cols + x] = 0;
      grid[(rows - 3) * cols + x] = 0;
    }
    for (let y = 2; y < rows - 2; y++) {
      grid[y * cols + 2] = 0;
      grid[y * cols + (cols - 3)] = 0;
    }
  }

  const NAMES_MARINE = ['HICKS','HUDSON','VASQUEZ','DRAKE','APONE','RIPLEY','BISHOP','GORMAN','BURKE','FROST'];
  const NAMES_XENO   = ['DRONE-Δ1','WARRIOR-Δ2','RUNNER-Δ3','QUEEN-Ω','SOLDIER-Δ4'];

  function pickWalkable() {
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = Math.floor(Math.random() * cols);
      const y = Math.floor(Math.random() * rows);
      if (walkable(x, y)) return { x, y };
    }
    // hard scan if random failed
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (walkable(x, y)) return { x, y };
    return { x: 5, y: 5 };
  }

  function makeEntity(kind, label) {
    const start = pickWalkable();
    return {
      kind, label,
      gx: start.x, gy: start.y,
      x: start.x * CELL, y: start.y * CELL,
      tx: start.x * CELL, ty: start.y * CELL,
      trail: [],
      lastBlip: 0,
      hp: kind === 'xeno' ? 3 : 99,
      dead: false,
      deadAt: 0,
      speed: kind === 'xeno' ? 0.6 + Math.random() * 0.4 : 0.45 + Math.random() * 0.3,
    };
  }

  let entities = [];
  function spawnEntities() {
    entities = [];
    NAMES_MARINE.forEach(n => entities.push(makeEntity('marine', n)));
    NAMES_XENO.forEach(n => entities.push(makeEntity('xeno', n)));
  }

  function nextTarget(e) {
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const [dx, dy] of dirs) {
      let nx = e.gx, ny = e.gy;
      let steps = 1 + Math.floor(Math.random() * 6);
      let advanced = 0;
      while (steps-- > 0 && walkable(nx + dx, ny + dy)) {
        nx += dx; ny += dy; advanced++;
      }
      if (advanced > 0) {
        e.gx = nx; e.gy = ny;
        e.tx = nx * CELL; e.ty = ny * CELL;
        return;
      }
    }
    const p = pickWalkable();
    e.gx = p.x; e.gy = p.y;
    e.x = e.tx = p.x * CELL; e.y = e.ty = p.y * CELL;
  }

  let sweepX = 0;
  let lastSweep = performance.now();
  let pendingPings = [];
  let mx = -9999, my = -9999;
  let hoverLabel = null;
  let hoverKind = null;
  let hoverEntity = null;
  let muzzles = []; // {x,y,ttl,max}
  let bullets = []; // {x1,y1,x2,y2,ttl,max}
  let splats  = []; // {x,y,ttl,max}
  let kills = 0;
  let shots = 0;

  function shoot() {
    if (mx < -1000) return;
    shots++;
    const killEl = document.getElementById('hud-shots');
    if (killEl) killEl.textContent = shots;
    // muzzle flash + bullet line from random screen edge to crosshair
    const fromX = mx + (Math.random() - 0.5) * 8;
    const fromY = H + 4;
    bullets.push({ x1: fromX, y1: fromY, x2: mx, y2: my, ttl: 180, max: 180 });
    muzzles.push({ x: mx, y: my, ttl: 240, max: 240 });
    if (window.AlienAudio && window.AlienAudio.shot) window.AlienAudio.shot();
    // hit xeno?
    if (hoverEntity && hoverEntity.kind === 'xeno' && !hoverEntity.dead) {
      hoverEntity.hp -= 1;
      if (hoverEntity.hp <= 0) {
        hoverEntity.dead = true;
        hoverEntity.deadAt = performance.now();
        splats.push({ x: hoverEntity.x + CELL/2, y: hoverEntity.y + CELL/2, ttl: 1400, max: 1400 });
        kills++;
        const k = document.getElementById('hud-kills');
        if (k) k.textContent = kills;
        if (window.AlienAudio && window.AlienAudio.splat) window.AlienAudio.splat();
      } else {
        // hit marker
        splats.push({ x: hoverEntity.x + CELL/2, y: hoverEntity.y + CELL/2, ttl: 300, max: 300, small: true });
      }
    }
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildGrid();
    spawnEntities();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  window.addEventListener('click', e => {
    // ignore clicks on actual links / buttons
    const t = e.target;
    if (t && (t.tagName === 'A' || t.tagName === 'BUTTON' || t.closest('a,button'))) return;
    shoot();
  });

  let last = performance.now();
  function draw(now) {
    try {
      const dt = Math.min(50, now - last);
      last = now;

      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(36,124,68,0.20)';
      ctx.lineWidth = 1;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!walkable(x, y)) continue;
          const px = x * CELL, py = y * CELL;
          if (!walkable(x, y - 1)) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + CELL, py); ctx.stroke(); }
          if (!walkable(x, y + 1)) { ctx.beginPath(); ctx.moveTo(px, py + CELL); ctx.lineTo(px + CELL, py + CELL); ctx.stroke(); }
          if (!walkable(x - 1, y)) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + CELL); ctx.stroke(); }
          if (!walkable(x + 1, y)) { ctx.beginPath(); ctx.moveTo(px + CELL, py); ctx.lineTo(px + CELL, py + CELL); ctx.stroke(); }
        }
      }

      ctx.fillStyle = 'rgba(36,124,68,0.08)';
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (walkable(x, y)) ctx.fillRect(x * CELL + CELL/2 - 0.5, y * CELL + CELL/2 - 0.5, 1, 1);
        }
      }

      hoverLabel = null; hoverKind = null; hoverEntity = null;
      for (const e of entities) {
        if (e.dead) {
          if (now - e.deadAt > 4000) {
            // respawn at new location
            const p = pickWalkable();
            e.gx = p.x; e.gy = p.y;
            e.x = e.tx = p.x * CELL; e.y = e.ty = p.y * CELL;
            e.trail = []; e.hp = 3; e.dead = false;
          }
          continue;
        }
        const dx = e.tx - e.x, dy = e.ty - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1.5) { nextTarget(e); }
        else {
          const step = e.speed * dt * 0.04;
          const k = Math.min(1, step / dist);
          e.x += dx * k; e.y += dy * k;
        }
        e.trail.push({ x: e.x + CELL/2, y: e.y + CELL/2, t: now });
        if (e.trail.length > 36) e.trail.shift();
        const cx = e.x + CELL/2, cy = e.y + CELL/2;
        if (Math.hypot(mx - cx, my - cy) < 18) {
          hoverLabel = e.label;
          hoverKind = e.kind;
          hoverEntity = e;
        }
      }

      for (const e of entities) {
        if (e.dead) continue;
        const col = e.kind === 'xeno' ? '255,72,72' : '76,255,138';
        for (let i = 0; i < e.trail.length - 1; i++) {
          const a = e.trail[i], b = e.trail[i + 1];
          const age = (now - a.t) / 1800;
          if (age >= 1) continue;
          ctx.strokeStyle = 'rgba(' + col + ',' + ((1 - age) * 0.5) + ')';
          ctx.lineWidth = (1 - age) * 2;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }

      const cycle = 4500;
      const p = ((now - lastSweep) % cycle) / cycle;
      sweepX = p * H;
      // very subtle sweep line — much softer than before
      ctx.strokeStyle = 'rgba(76,255,138,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, sweepX); ctx.lineTo(W, sweepX); ctx.stroke();

      for (const e of entities) {
        if (e.dead) continue;
        const cy = e.y + CELL/2;
        if (Math.abs(cy - sweepX) < 8 && now - e.lastBlip > cycle - 100) {
          pendingPings.push({ x: e.x + CELL/2, y: cy, ttl: 700, max: 700, kind: e.kind });
          e.lastBlip = now;
          if (window.AlienAudio && window.AlienAudio.ping) window.AlienAudio.ping(e.kind === 'xeno');
        }
      }

      for (const e of entities) {
        if (e.dead) continue;
        const cx = e.x + CELL/2, cy = e.y + CELL/2;
        const isHover = (e === hoverEntity);
        if (e.kind === 'xeno') {
          ctx.shadowBlur = isHover ? 22 : 12;
          ctx.shadowColor = 'rgba(255,72,72,0.9)';
          ctx.fillStyle = isHover ? '#ff9090' : '#ff4848';
        } else {
          ctx.shadowBlur = isHover ? 22 : 10;
          ctx.shadowColor = 'rgba(76,255,138,0.7)';
          ctx.fillStyle = isHover ? '#aaffcc' : '#4cff8a';
        }
        ctx.beginPath(); ctx.arc(cx, cy, isHover ? 5.5 : 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // HP pips for xeno when shot
        if (e.kind === 'xeno' && e.hp < 3) {
          ctx.fillStyle = 'rgba(255,160,160,0.85)';
          for (let i = 0; i < e.hp; i++) {
            ctx.fillRect(cx - 8 + i * 6, cy - 14, 4, 2);
          }
        }
        if (isHover) {
          ctx.font = '700 11px "DM Mono", monospace';
          ctx.fillStyle = e.kind === 'xeno' ? '#ff7878' : '#88ffae';
          ctx.textAlign = 'center';
          ctx.fillText(e.label, cx, cy + 22);
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.font = '500 9px "DM Mono", monospace';
          ctx.fillText(e.kind === 'xeno' ? 'XENOMORPH · CLICK TO FIRE' : 'COLONIAL MARINE', cx, cy + 34);
        }
      }

      // bullets
      bullets = bullets.filter(b => b.ttl > 0);
      for (const b of bullets) {
        const t = 1 - b.ttl / b.max;
        ctx.strokeStyle = 'rgba(255,200,80,' + ((1 - t) * 0.9) + ')';
        ctx.lineWidth = 2 * (1 - t * 0.5);
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,210,' + ((1 - t) * 0.5) + ')';
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        b.ttl -= dt;
      }
      // muzzle flash
      muzzles = muzzles.filter(m => m.ttl > 0);
      for (const m of muzzles) {
        const t = 1 - m.ttl / m.max;
        const r = 6 + t * 12;
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
        g.addColorStop(0, 'rgba(255,230,140,' + ((1 - t) * 0.8) + ')');
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
        m.ttl -= dt;
      }
      // acid splats
      splats = splats.filter(s => s.ttl > 0);
      for (const s of splats) {
        const t = 1 - s.ttl / s.max;
        if (s.small) {
          ctx.strokeStyle = 'rgba(255,220,80,' + ((1 - t) * 0.9) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(s.x, s.y, 6 + t * 6, 0, Math.PI * 2); ctx.stroke();
        } else {
          // green acid blood with splatter
          const r = 4 + t * 26;
          ctx.fillStyle = 'rgba(120,220,80,' + ((1 - t) * 0.5) + ')';
          ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
          // droplets
          if (t < 0.3) {
            ctx.fillStyle = 'rgba(160,255,120,' + ((1 - t) * 0.8) + ')';
            for (let k = 0; k < 6; k++) {
              const ang = (k / 6) * Math.PI * 2 + t * 4;
              ctx.beginPath();
              ctx.arc(s.x + Math.cos(ang) * r * 0.9, s.y + Math.sin(ang) * r * 0.9, 1.6, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        s.ttl -= dt;
      }

      if (mx > -1000) {
        ctx.strokeStyle = hoverKind === 'xeno' ? 'rgba(255,80,80,0.55)' : 'rgba(76,255,138,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx - 18, my); ctx.lineTo(mx - 6, my);
        ctx.moveTo(mx + 6, my);  ctx.lineTo(mx + 18, my);
        ctx.moveTo(mx, my - 18); ctx.lineTo(mx, my - 6);
        ctx.moveTo(mx, my + 6);  ctx.lineTo(mx, my + 18);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(mx, my, 22, 0, Math.PI * 2); ctx.stroke();
      }
    } catch (err) {
      console.error('[tracker draw]', err);
    }
    requestAnimationFrame(draw);
  }

  try {
    resize();
    requestAnimationFrame(draw);
  } catch (err) {
    console.error('[tracker init]', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', __initTracker);
} else {
  __initTracker();
}

