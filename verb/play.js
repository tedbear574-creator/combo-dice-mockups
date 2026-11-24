// Combo Dice: what your character does. One board, four ways to play it (window.MODE):
// watch (the board rolls itself), stomp (jump on a die to roll it), throw (lob a die at the board),
// carry (lift and swap dice while the board rolls itself). Distances in studs, Roblox's gravity,
// walk speed and jump, and its 70 degree camera.
(function () {
  "use strict";
  const MODE = window.MODE || "watch";
  const T = window.THREE;

  // ---- numbers -------------------------------------------------------------------------------
  const N = 5, CELL = 4, GAP = 0.5, PITCH = CELL + GAP, TOP = CELL;
  const G = 196.2, WALK = 16, JUMP_V = 53.2, RADIUS = 0.9;
  const AUTO = { watch: 5, carry: 6 }[MODE] || 0;
  const KIND_MULT = [0, 0, 1, 3, 6, 12, 20, 30, 42, 56, 72, 90, 110, 130];
  const STRAIGHT_MULT = [0, 0, 0, 2, 5, 10];
  const FLUSH_X = 3;
  const COLORS = {
    white: { body: "#f3efe6", edge: "#d9d2c3", ink: "#1f2633", glow: 0xffffff },
    red: { body: "#e2473d", edge: "#b8322a", ink: "#ffffff", glow: 0xff6a5a },
    blue: { body: "#3a7ae0", edge: "#2a5cb0", ink: "#ffffff", glow: 0x6aa8ff },
    green: { body: "#3daf5b", edge: "#2b8644", ink: "#ffffff", glow: 0x7cf09a },
    yellow: { body: "#f4c430", edge: "#c99a17", ink: "#2a2418", glow: 0xffe066 },
  };
  const PAINT = ["red", "blue", "green", "yellow"];
  // a fair die: opposite sides sum to 7; faces in BoxGeometry order +x -x +y -y +z -z
  const FACE_NUMS = [3, 4, 1, 6, 2, 5];
  const FACE_NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  const rand = (n) => Math.floor(Math.random() * n);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  // ---- page ----------------------------------------------------------------------------------
  const css = document.createElement("style");
  css.textContent = `
  html,body{margin:0;height:100%;overflow:hidden;background:#9fd3ff;font-family:"Arial Black","Segoe UI",Arial,sans-serif;
    user-select:none;-webkit-user-select:none;touch-action:none}
  canvas{display:block}
  .hud{position:fixed;pointer-events:none;color:#fff;text-shadow:0 2px 0 #1b2a44,0 0 6px rgba(0,0,0,.35)}
  #points{top:12px;left:50%;transform:translateX(-50%);font-size:40px;letter-spacing:1px;transition:transform .08s}
  #points.bump{transform:translateX(-50%) scale(1.18)}
  #sub{top:62px;left:50%;transform:translateX(-50%);font-size:16px;display:flex;gap:10px;align-items:center}
  #bar{width:120px;height:8px;border-radius:4px;background:rgba(0,0,0,.25);overflow:hidden}
  #bar i{display:block;height:100%;background:#ffe066;width:0}
  #modes{top:10px;left:10px;display:flex;gap:6px;pointer-events:auto}
  #modes a{font-size:13px;padding:6px 10px;border-radius:8px;background:rgba(20,30,50,.55);color:#fff;text-decoration:none;text-shadow:none}
  #modes a.on{background:#ffd040;color:#22201a}
  #keys{bottom:10px;left:12px;font-size:12px;font-family:"Segoe UI",Arial,sans-serif;font-weight:700;opacity:.9}
  .float{position:fixed;pointer-events:none;transform:translate(-50%,-50%);white-space:nowrap;text-align:center;
    color:#fff;text-shadow:0 2px 0 #1b2a44,0 0 8px rgba(0,0,0,.4);font-size:20px;line-height:1.05}
  .float b{display:block;font-size:26px;color:#ffe066}
  .float.straight b{color:#7fe8ff}
  .float.flush b{color:#ff9cf0}
  #total{top:34%;left:50%;transform:translate(-50%,-50%) scale(.6);font-size:64px;opacity:0;transition:none;color:#ffe066}
  #combo{top:96px;left:50%;transform:translateX(-50%);font-size:24px;color:#ff9cf0;opacity:0}
  #power{bottom:110px;left:50%;transform:translateX(-50%);width:200px;height:12px;border-radius:6px;background:rgba(0,0,0,.3);
    overflow:hidden;opacity:0}
  #power i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7fe8ff,#ffe066,#ff6a5a)}
  .btn{position:fixed;pointer-events:auto;border-radius:50%;background:rgba(20,30,50,.45);color:#fff;font-size:14px;
    display:none;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.5)}
  #jump{right:24px;bottom:28px;width:84px;height:84px}
  #act{right:118px;bottom:40px;width:70px;height:70px}
  #stick{position:fixed;left:30px;bottom:30px;width:120px;height:120px;border-radius:50%;background:rgba(20,30,50,.25);
    border:2px solid rgba(255,255,255,.35);display:none;pointer-events:none}
  #stick i{position:absolute;left:40px;top:40px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.6)}
  body.touch .btn{display:flex} body.touch #stick{display:block} body.touch #keys{display:none}
  `;
  document.head.appendChild(css);
  const html = (s) => { const d = document.createElement("div"); d.innerHTML = s.trim(); return d.firstChild; };
  const ACT_LABEL = { watch: "Roll", throw: "Throw", carry: "Lift" }[MODE];
  const KEYS = {
    watch: "WASD move · Space jump · drag to look · R roll",
    stomp: "WASD move · Space jump · drag to look · land on a die to roll it",
    throw: "WASD move · Space jump · drag to look · hold F to throw",
    carry: "WASD move · Space jump · drag to look · E lift / put down",
  }[MODE];
  const ui = {
    points: document.body.appendChild(html(`<div class="hud" id="points">0</div>`)),
    sub: document.body.appendChild(html(`<div class="hud" id="sub"></div>`)),
    modes: document.body.appendChild(html(`<div class="hud" id="modes">${["watch", "stomp", "throw", "carry"]
      .map((m) => `<a href="${m}.html" class="${m === MODE ? "on" : ""}">${m[0].toUpperCase() + m.slice(1)}</a>`).join("")}</div>`)),
    keys: document.body.appendChild(html(`<div class="hud" id="keys">${KEYS}</div>`)),
    total: document.body.appendChild(html(`<div class="hud" id="total"></div>`)),
    combo: document.body.appendChild(html(`<div class="hud" id="combo"></div>`)),
    power: document.body.appendChild(html(`<div class="hud" id="power"><i></i></div>`)),
    jump: document.body.appendChild(html(`<div class="btn" id="jump">Jump</div>`)),
    act: ACT_LABEL ? document.body.appendChild(html(`<div class="btn" id="act">${ACT_LABEL}</div>`)) : null,
    stick: document.body.appendChild(html(`<div id="stick"><i></i></div>`)),
  };
  if (AUTO) ui.sub.innerHTML = `<div id="bar"><i></i></div>`;
  const barFill = ui.sub.querySelector("#bar i");

  // ---- sound ---------------------------------------------------------------------------------
  let ac = null, master = null, noiseBuf = null, lastClack = 0;
  function audio() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function clack(level = 1) {
    if (!ac) return; const now = ac.currentTime; if (now - lastClack < 0.025) return; lastClack = now;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800 + Math.random() * 1400; bp.Q.value = 3;
    const g = ac.createGain(); env(g, now, 0.002, 0.5 * level, 0.07);
    src.connect(bp).connect(g).connect(master); src.start(now); src.stop(now + 0.12);
    const o = ac.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(220 + Math.random() * 60, now);
    o.frequency.exponentialRampToValueAtTime(90, now + 0.08);
    const g2 = ac.createGain(); env(g2, now, 0.002, 0.35 * level, 0.09); o.connect(g2).connect(master); o.start(now); o.stop(now + 0.12);
  }
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
  function chime(step, big) {
    if (!ac) return; const now = ac.currentTime; const f = 392 * Math.pow(2, SCALE[Math.min(step, SCALE.length - 1)] / 12);
    [[1, "triangle", 0.28], [2, "sine", 0.1], [big ? 1.5 : 0, "sine", 0.12]].forEach(([m, type, v]) => {
      if (!m) return; const o = ac.createOscillator(); o.type = type; o.frequency.value = f * m;
      const g = ac.createGain(); env(g, now, 0.005, v, big ? 0.9 : 0.45); o.connect(g).connect(master); o.start(now); o.stop(now + 1.1);
    });
  }
  function fanfare(size) {
    if (!ac) return; const now = ac.currentTime;
    [0, 4, 7, 12].slice(0, size >= 3 ? 4 : 3).forEach((s, i) => {
      const o = ac.createOscillator(); o.type = "square"; o.frequency.value = 523 * Math.pow(2, s / 12);
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
      const g = ac.createGain(); env(g, now + i * 0.06, 0.01, 0.07, 0.6); o.connect(lp).connect(g).connect(master); o.start(now + i * 0.06); o.stop(now + 1);
    });
  }
  function thud() {
    if (!ac) return; const now = ac.currentTime; const o = ac.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(140, now); o.frequency.exponentialRampToValueAtTime(70, now + 0.15);
    const g = ac.createGain(); env(g, now, 0.005, 0.18, 0.18); o.connect(g).connect(master); o.start(now); o.stop(now + 0.3);
  }
  function whoosh(p) {
    if (!ac) return; const now = ac.currentTime; const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(400, now); bp.frequency.exponentialRampToValueAtTime(1200 + 1500 * p, now + 0.25);
    const g = ac.createGain(); env(g, now, 0.03, 0.25, 0.22); src.connect(bp).connect(g).connect(master); src.start(now); src.stop(now + 0.3);
  }
  function blip(up) {
    if (!ac) return; const now = ac.currentTime; const o = ac.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(up ? 500 : 700, now); o.frequency.exponentialRampToValueAtTime(up ? 900 : 400, now + 0.08);
    const g = ac.createGain(); env(g, now, 0.003, 0.15, 0.1); o.connect(g).connect(master); o.start(now); o.stop(now + 0.15);
  }

  // ---- scene ---------------------------------------------------------------------------------
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  document.body.prepend(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color(0x9fd3ff); scene.fog = new T.Fog(0x9fd3ff, 140, 340);
  const camera = new T.PerspectiveCamera(70, 1, 0.1, 1000);
  scene.add(new T.HemisphereLight(0xe6f4ff, 0x6f8f55, 1.1));
  const sun = new T.DirectionalLight(0xffffff, 1.9); sun.position.set(35, 70, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 200 });
  sun.shadow.bias = -0.0005; scene.add(sun);
  const ground = new T.Mesh(new T.PlaneGeometry(800, 800), new T.MeshStandardMaterial({ color: 0x67a84c, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const pad = new T.Mesh(new T.BoxGeometry(46, 0.3, 46), new T.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.9 }));
  pad.position.y = 0.1 - 0.15; pad.receiveShadow = true; scene.add(pad);
  const bed = new T.Mesh(new T.BoxGeometry(N * PITCH + 1.2, 0.3, N * PITCH + 1.2), new T.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.8 }));
  bed.position.y = 0.2 - 0.15; bed.receiveShadow = true; scene.add(bed);
  // trees round the plot, for scale
  const trunkM = new T.MeshStandardMaterial({ color: 0x7a5232 }), leafM = new T.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.9 });
  [[-34, -30], [36, -28], [-38, 26], [40, 30], [0, -44], [-58, 0], [60, -6]].forEach(([x, z]) => {
    const t = new T.Mesh(new T.CylinderGeometry(0.8, 1, 8), trunkM); t.position.set(x, 4, z); t.castShadow = true; scene.add(t);
    const l = new T.Mesh(new T.SphereGeometry(5, 12, 10), leafM); l.position.set(x, 10, z); l.castShadow = true; scene.add(l);
  });

  // ---- dice ----------------------------------------------------------------------------------
  function roundedBox(size, r, seg) {
    const g = new T.BoxGeometry(size, size, size, seg, seg, seg); const p = g.attributes.position, nrm = g.attributes.normal;
    const h = size / 2, inner = h - r, v = new T.Vector3(), c = new T.Vector3(), d = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      c.set(clamp(v.x, -inner, inner), clamp(v.y, -inner, inner), clamp(v.z, -inner, inner));
      d.subVectors(v, c);
      if (d.lengthSq() > 1e-9) { d.normalize(); v.copy(c).addScaledVector(d, r); p.setXYZ(i, v.x, v.y, v.z); nrm.setXYZ(i, d.x, d.y, d.z); }
    }
    p.needsUpdate = true; nrm.needsUpdate = true; return g;
  }
  const DIE_GEO = roundedBox(CELL, 0.55, 12);
  const texCache = {};
  function faceTex(n, color) {
    const key = n + color; if (texCache[key]) return texCache[key];
    const c = COLORS[color], cv = document.createElement("canvas"); cv.width = cv.height = 256; const x = cv.getContext("2d");
    x.fillStyle = c.edge; x.fillRect(0, 0, 256, 256);
    const gr = x.createRadialGradient(128, 118, 20, 128, 128, 170); gr.addColorStop(0, c.body); gr.addColorStop(0.75, c.body); gr.addColorStop(1, c.edge);
    x.fillStyle = gr; x.beginPath(); x.roundRect(10, 10, 236, 236, 46); x.fill();
    x.font = "900 150px 'Arial Black', Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillStyle = "rgba(0,0,0,.28)"; x.fillText(String(n), 131, 141);
    x.fillStyle = "rgba(255,255,255,.35)"; x.fillText(String(n), 126, 134);
    x.fillStyle = c.ink; x.fillText(String(n), 128, 137);
    if (n === 6 || n === 9) { x.fillRect(96, 210, 64, 10); }
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; texCache[key] = t; return t;
  }
  function orientFor(n) {
    const f = FACE_NUMS.indexOf(n); const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(...FACE_NORMALS[f]), new T.Vector3(0, 1, 0));
    if (f === 3) q.setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI);
    return new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), (rand(4) * Math.PI) / 2).multiply(q);
  }
  function makeDie(color) {
    const mats = FACE_NUMS.map((n) => new T.MeshStandardMaterial({ map: faceTex(n, color), roughness: 0.42, metalness: 0, emissive: 0x000000 }));
    const m = new T.Mesh(DIE_GEO, mats); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
  }
  const cellX = (i) => (i - (N - 1) / 2) * PITCH;
  const grid = []; // grid[r*N+c] = die or null
  const allDice = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const color = MODE === "carry" ? PAINT[rand(4)] : (Math.random() < 0.55 ? "white" : PAINT[rand(4)]);
    const d = { color, num: 1 + rand(6), mesh: makeDie(color), anim: null, glow: 0, glowColor: new T.Color(), lift: 0, squash: 0, cell: r * N + c };
    d.mesh.quaternion.copy(orientFor(d.num)); grid.push(d); allDice.push(d);
  }
  function placeAt(d, idx) { d.cell = idx; grid[idx] = d; }
  const cellPos = (idx) => new T.Vector3(cellX(idx % N), 0, cellX(Math.floor(idx / N)));
  function cellAt(x, z) {
    const c = Math.round(x / PITCH + (N - 1) / 2), r = Math.round(z / PITCH + (N - 1) / 2);
    if (c < 0 || c >= N || r < 0 || r >= N) return -1;
    if (Math.abs(x - cellX(c)) > CELL / 2 + GAP / 2 || Math.abs(z - cellX(r)) > CELL / 2 + GAP / 2) return -1;
    return r * N + c;
  }
  // a few neighbours' boards on the plaza, still, so the plot sits in a world
  [[-70, -60], [72, -58], [-74, 64]].forEach(([ox, oz]) => {
    for (let i = 0; i < 9; i++) { const m = makeDie(i % 3 ? "white" : PAINT[rand(4)]); m.quaternion.copy(orientFor(1 + rand(6))); m.position.set(ox + (i % 3) * PITCH, 2, oz + Math.floor(i / 3) * PITCH); }
  });

  // ---- rolling ------------------------------------------------------------------------------
  const batches = [];
  function roll(dice, opts = {}) {
    const b = { dice: new Set(dice), left: dice.length, scope: opts.scope || "touching", mult: opts.mult || 1, combo: opts.combo || 0 };
    dice.forEach((d, k) => {
      if (d.anim) { b.left--; b.dice.delete(d); return; }
      d.num = 1 + rand(6);
      const axis = new T.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize();
      d.anim = { t: -(opts.stagger ? opts.stagger(d, k) : 0), dur: opts.dur || 0.72, hop: opts.hop || 4.5, from: d.mesh.quaternion.clone(),
        to: orientFor(d.num), axis, turns: (1.5 + Math.random() * 1.5) * Math.PI * 2, batch: b };
    });
    if (b.left > 0) batches.push(b);
    return b;
  }
  const qa = new T.Quaternion(), qb = new T.Quaternion();
  function updateDice(dt) {
    for (const d of allDice) {
      if (d === carried) continue;
      const base = cellPos(d.cell); let y = CELL / 2;
      const a = d.anim;
      if (a) {
        a.t += dt;
        if (a.t >= 0) {
          const u = Math.min(1, a.t / a.dur), e = 1 - Math.pow(1 - u, 3);
          y += a.hop * 4 * u * (1 - u);
          qa.setFromAxisAngle(a.axis, (1 - e) * a.turns); qb.copy(a.to).multiply(qa);
          d.mesh.quaternion.slerpQuaternions(a.from, qb, Math.min(1, u / 0.18));
          if (u >= 1) { d.mesh.quaternion.copy(a.to); d.anim = null; d.squash = 1; landed(d, a.batch); }
        }
      }
      if (d.squash > 0) d.squash = Math.max(0, d.squash - dt * 7);
      const s = 1 - 0.14 * Math.sin(d.squash * Math.PI);
      d.mesh.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6);
      d.lift += ((d.glow > 0.05 ? 0.9 : 0) - d.lift) * Math.min(1, dt * 14);
      d.mesh.position.set(base.x, y - (1 - s) * CELL / 2 + d.lift, base.z);
      d.glow = Math.max(0, d.glow - dt * 0.9);
      for (const m of d.mesh.material) { m.emissive.copy(d.glowColor).multiplyScalar(d.glow * 0.55); }
    }
  }
  function landed(d, b) {
    clack(b.dice.size > 6 ? 0.7 : 1); dust(d.mesh.position.clone().setY(0.2), 1);
    b.left--; if (b.left <= 0) { batches.splice(batches.indexOf(b), 1); resolve(b); }
  }

  // ---- hands --------------------------------------------------------------------------------
  const NAMES = ["", "", "Pair", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
  function findHands() {
    const out = [], seen = new Set();
    for (let i = 0; i < N * N; i++) {
      const d = grid[i]; if (!d || seen.has(i)) continue;
      const group = [i]; seen.add(i);
      for (let k = 0; k < group.length; k++) {
        const j = group[k], r = Math.floor(j / N), c = j % N;
        [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([rr, cc]) => {
          if (rr < 0 || rr >= N || cc < 0 || cc >= N) return; const n = rr * N + cc;
          if (!seen.has(n) && grid[n] && grid[n].num === d.num) { seen.add(n); group.push(n); }
        });
      }
      if (group.length >= 2) {
        const sz = group.length;
        out.push({ kind: "kind", cells: group, pay: d.num * sz * KIND_MULT[Math.min(sz, KIND_MULT.length - 1)],
          name: sz === 2 ? `Pair of ${d.num}s` : `${NAMES[sz] || sz} ${d.num}s`, size: sz });
      }
    }
    for (let line = 0; line < 2 * N; line++) {
      const cells = []; for (let k = 0; k < N; k++) cells.push(line < N ? line * N + k : k * N + (line - N));
      for (const dir of [1, -1]) {
        let run = [cells[0]];
        const flush = () => {
          if (run.length >= 3) {
            const nums = run.map((i) => grid[i].num), sum = nums.reduce((a, b) => a + b, 0);
            out.push({ kind: "straight", cells: run.slice(), pay: sum * STRAIGHT_MULT[run.length], size: run.length,
              name: `Straight ${Math.min(...nums)}-${Math.max(...nums)}` });
          }
        };
        for (let k = 1; k < N; k++) {
          const a = grid[run[run.length - 1]], b = grid[cells[k]];
          if (a && b && b.num === a.num + dir) run.push(cells[k]); else { flush(); run = [cells[k]]; }
        }
        flush();
      }
    }
    for (const h of out) {
      const col = grid[h.cells[0]].color;
      if (col !== "white" && h.cells.every((i) => grid[i].color === col)) { h.pay *= FLUSH_X; h.flush = col; }
    }
    out.sort((a, b) => b.pay - a.pay);
    const used = new Set(), kept = [];
    for (const h of out) if (h.cells.every((i) => !used.has(i))) { h.cells.forEach((i) => used.add(i)); kept.push(h); }
    return kept;
  }
  function colourGroups() {
    const out = [], seen = new Set();
    for (let i = 0; i < N * N; i++) {
      const d = grid[i]; if (!d || d.color === "white" || seen.has(i)) continue;
      const group = [i]; seen.add(i);
      for (let k = 0; k < group.length; k++) {
        const j = group[k], r = Math.floor(j / N), c = j % N;
        [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([rr, cc]) => {
          if (rr < 0 || rr >= N || cc < 0 || cc >= N) return; const n = rr * N + cc;
          if (!seen.has(n) && grid[n] && grid[n].color === d.color) { seen.add(n); group.push(n); }
        });
      }
      if (group.length >= 4) out.push({ kind: "colour", cells: group, pay: group.length * group.length * 3, size: group.length,
        name: `${d.color[0].toUpperCase() + d.color.slice(1)} x${group.length}`, flush: d.color });
    }
    return out;
  }

  // ---- paying out ---------------------------------------------------------------------------
  let points = 0, shown = 0, shake = 0;
  const timers = [];
  const later = (s, fn) => timers.push({ t: s, fn });
  function resolve(b) {
    let list = findHands();
    if (b.scope === "touching") list = list.filter((h) => h.cells.some((i) => b.dice.has(grid[i])));
    if (MODE === "carry" && b.scope === "all") list = list.concat(colourGroups());
    if (!list.length) { thud(); return; }
    list.sort((a, c) => a.pay - c.pay);
    let total = 0;
    list.forEach((h, k) => {
      const pay = Math.round(h.pay * b.mult); total += pay;
      later(k * 0.32, () => {
        const big = h.size >= 4 || h.pay >= 150;
        const col = new T.Color(h.flush ? COLORS[h.flush].glow : h.kind === "straight" ? 0x7fe8ff : 0xffd040);
        h.cells.forEach((i) => { const d = grid[i]; if (d) { d.glow = 1.6; d.glowColor.copy(col); } });
        chime(k + (h.size - 2), big);
        const c = centroid(h.cells);
        floatText(c, `<b>+${fmt(pay)}</b>${h.name}${h.flush && h.kind !== "colour" ? " · x" + FLUSH_X : ""}`, h.flush ? "flush" : h.kind);
        points += pay;
        if (big) { burst(c, col, 14 + h.size * 3); shake = Math.min(1, shake + 0.35 + h.size * 0.05); }
      });
    });
    const end = (list.length - 1) * 0.32 + 0.35;
    if (list.length > 1 || total >= 150) later(end, () => { showTotal(total, b.mult); fanfare(list.length); });
  }
  function centroid(cells) {
    const v = new T.Vector3(); cells.forEach((i) => v.add(cellPos(i))); return v.divideScalar(cells.length).setY(CELL + 2.5);
  }
  const floats = [];
  function floatText(pos, inner, cls) {
    const el = document.createElement("div"); el.className = "float " + (cls || ""); el.innerHTML = inner; document.body.appendChild(el);
    floats.push({ el, pos: pos.clone(), t: 0, life: 1.6 });
  }
  let totalT = 9;
  function showTotal(total, mult) {
    ui.total.innerHTML = `+${fmt(total)}${mult > 1 ? `<div style="font-size:24px;color:#ff9cf0">combo x${mult.toFixed(2).replace(/\.?0+$/, "")}</div>` : ""}`;
    totalT = 0;
  }
  // particles
  const partGeo = new T.BoxGeometry(0.6, 0.6, 0.6), parts = [];
  function burst(pos, color, n) {
    for (let i = 0; i < n; i++) {
      const m = new T.Mesh(partGeo, new T.MeshBasicMaterial({ color })); m.position.copy(pos); scene.add(m);
      parts.push({ m, v: new T.Vector3((Math.random() - 0.5) * 30, 18 + Math.random() * 22, (Math.random() - 0.5) * 30), t: 0, life: 0.9 + Math.random() * 0.4 });
    }
  }
  const ringGeo = new T.RingGeometry(0.8, 1.3, 24);
  function dust(pos, s) {
    const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos); scene.add(m); parts.push({ m, ring: s, t: 0, life: 0.35 });
  }
  function updateFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt; const u = p.t / p.life;
      if (p.ring) { const s = 1 + u * 3 * p.ring; p.m.scale.set(s, s, s); p.m.material.opacity = 0.5 * (1 - u); }
      else { p.v.y -= 60 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 8; p.m.rotation.y += dt * 6; const s = Math.max(0.01, 1 - u); p.m.scale.set(s, s, s); }
      if (u >= 1) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); }
    }
    const v = new T.Vector3();
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.t += dt; const u = f.t / f.life;
      v.copy(f.pos).setY(f.pos.y + u * 4).project(camera);
      f.el.style.left = ((v.x + 1) / 2) * innerWidth + "px"; f.el.style.top = ((1 - v.y) / 2) * innerHeight + "px";
      const pop = u < 0.12 ? 0.6 + (u / 0.12) * 0.55 : u < 0.2 ? 1.15 - ((u - 0.12) / 0.08) * 0.15 : 1;
      f.el.style.transform = `translate(-50%,-50%) scale(${pop})`; f.el.style.opacity = u > 0.75 ? (1 - u) / 0.25 : 1;
      if (u >= 1 || v.z > 1) { f.el.remove(); floats.splice(i, 1); }
    }
    totalT += dt;
    if (totalT < 1.6) {
      const u = totalT / 1.6, s = u < 0.15 ? 0.6 + u / 0.15 * 0.6 : u < 0.25 ? 1.2 - (u - 0.15) * 2 : 1;
      ui.total.style.opacity = u > 0.75 ? (1 - u) / 0.25 : 1; ui.total.style.transform = `translate(-50%,-50%) scale(${s})`;
    } else ui.total.style.opacity = 0;
    if (shown < points) {
      const before = Math.floor(shown); shown = Math.min(points, shown + Math.max(1, (points - shown) * dt * 8));
      ui.points.textContent = fmt(shown); if (Math.floor(shown) !== before) { ui.points.classList.add("bump"); bumpT = 0.08; }
    }
    if (bumpT > 0) { bumpT -= dt; if (bumpT <= 0) ui.points.classList.remove("bump"); }
    for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
  }
  let bumpT = 0;

  // ---- character ----------------------------------------------------------------------------
  const ch = { p: new T.Vector3(0, 0, 19), v: new T.Vector3(), yaw: Math.PI, onGround: true, groundDie: null, phase: 0, jumped: false };
  const body = new T.Group(); scene.add(body);
  const box = (w, h, d, color, x, y, z, parent) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color, roughness: 0.7 })); m.position.set(x, y, z); m.castShadow = true; (parent || body).add(m); return m; };
  const joint = (x, y, z) => { const g = new T.Group(); g.position.set(x, y, z); body.add(g); return g; };
  box(2, 2, 1, 0x2f6fd0, 0, 3, 0); box(1.2, 1.2, 1.2, 0xf5cd30, 0, 4.6, 0);
  const lArm = joint(-1.5, 4, 0), rArm = joint(1.5, 4, 0), lLeg = joint(-0.5, 2, 0), rLeg = joint(0.5, 2, 0);
  box(1, 2, 1, 0xf5cd30, 0, -1, 0, lArm); box(1, 2, 1, 0xf5cd30, 0, -1, 0, rArm); box(1, 2, 1, 0x3c8f3c, 0, -1, 0, lLeg); box(1, 2, 1, 0x3c8f3c, 0, -1, 0, rLeg);

  // ---- input --------------------------------------------------------------------------------
  const keys = {}; const cam = { yaw: 0, pitch: 0.5, dist: 24 };
  const stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
  let jumpQueued = false, actDown = false, actPressed = false;
  addEventListener("keydown", (e) => {
    audio(); if (e.repeat) return; keys[e.code] = true;
    if (e.code === "Space") jumpQueued = true;
    if ((MODE === "throw" && e.code === "KeyF") || (MODE === "carry" && e.code === "KeyE") || (MODE === "watch" && e.code === "KeyR")) { actDown = true; actPressed = true; }
  });
  addEventListener("keyup", (e) => {
    keys[e.code] = false;
    if ((MODE === "throw" && e.code === "KeyF") || (MODE === "carry" && e.code === "KeyE") || (MODE === "watch" && e.code === "KeyR")) actDown = false;
  });
  const canvas = renderer.domElement; let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    audio();
    if (e.pointerType === "touch") {
      document.body.classList.add("touch");
      if (e.clientX < innerWidth * 0.4 && stick.id === null) { stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; return; }
    }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId === stick.id) {
      const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, l = Math.hypot(dx, dy), m = Math.min(l, 50) / (l || 1);
      stick.x = (dx * m) / 50; stick.y = (dy * m) / 50; ui.stick.firstChild.style.transform = `translate(${dx * m}px,${dy * m}px)`; return;
    }
    if (drag && e.pointerId === drag.id) {
      cam.yaw -= (e.clientX - drag.x) * 0.006; cam.pitch = clamp(cam.pitch + (e.clientY - drag.y) * 0.005, -0.15, 1.35);
      drag.x = e.clientX; drag.y = e.clientY;
    }
  });
  const endPtr = (e) => {
    if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; ui.stick.firstChild.style.transform = ""; }
    if (drag && e.pointerId === drag.id) drag = null;
  };
  canvas.addEventListener("pointerup", endPtr); canvas.addEventListener("pointercancel", endPtr);
  canvas.addEventListener("wheel", (e) => { cam.dist = clamp(cam.dist * (e.deltaY > 0 ? 1.1 : 0.9), 8, 60); e.preventDefault(); }, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  ui.jump.addEventListener("pointerdown", (e) => { audio(); jumpQueued = true; e.preventDefault(); });
  if (ui.act) {
    ui.act.addEventListener("pointerdown", (e) => { audio(); actDown = true; actPressed = true; e.preventDefault(); });
    ui.act.addEventListener("pointerup", () => { actDown = false; }); ui.act.addEventListener("pointercancel", () => { actDown = false; });
  }

  // ---- moving the character -----------------------------------------------------------------
  let combo = 0, lastStomp = null, comboT = 0;
  function dieTopAt(x, z, r) {
    let best = null;
    for (let i = 0; i < N * N; i++) {
      const d = grid[i]; if (!d) continue; const c = cellPos(i);
      if (Math.abs(x - c.x) <= CELL / 2 + r && Math.abs(z - c.z) <= CELL / 2 + r) best = d;
    }
    return best;
  }
  function moveChar(dt) {
    let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stick.x;
    let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + stick.y;
    const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const mx = rx * ix - fx * iz, mz = rz * ix - fz * iz;
    const speed = carried ? WALK * 0.85 : WALK;
    ch.v.x = mx * speed; ch.v.z = mz * speed;
    if (Math.hypot(mx, mz) > 0.1) { const target = Math.atan2(mx, mz); let dy = target - ch.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.yaw += dy * Math.min(1, dt * 14); }
    if (aiming) ch.yaw = Math.atan2(fx, fz);
    if (jumpQueued && ch.onGround) { ch.v.y = JUMP_V; ch.onGround = false; ch.jumped = true; }
    jumpQueued = false;
    ch.v.y -= G * dt; ch.p.addScaledVector(ch.v, dt);
    // sides of the dice
    for (let i = 0; i < N * N; i++) {
      const d = grid[i]; if (!d) continue; const c = cellPos(i);
      if (ch.p.y >= TOP - 0.4) continue;
      const nx = clamp(ch.p.x, c.x - CELL / 2, c.x + CELL / 2), nz = clamp(ch.p.z, c.z - CELL / 2, c.z + CELL / 2);
      let dx = ch.p.x - nx, dz = ch.p.z - nz; const dist = Math.hypot(dx, dz);
      if (dist < RADIUS) {
        if (dist > 1e-6) { ch.p.x = nx + (dx / dist) * RADIUS; ch.p.z = nz + (dz / dist) * RADIUS; }
        else { const px = CELL / 2 - Math.abs(ch.p.x - c.x), pz = CELL / 2 - Math.abs(ch.p.z - c.z);
          if (px < pz) ch.p.x = c.x + Math.sign(ch.p.x - c.x) * (CELL / 2 + RADIUS); else ch.p.z = c.z + Math.sign(ch.p.z - c.z) * (CELL / 2 + RADIUS); }
      }
    }
    const under = ch.p.y >= TOP - 0.6 ? dieTopAt(ch.p.x, ch.p.z, RADIUS * 0.5) : null;
    const floor = under ? TOP : 0;
    if (ch.p.y <= floor && ch.v.y <= 0) {
      const wasAir = !ch.onGround, jumped = ch.jumped;
      ch.jumped = false; ch.p.y = floor; ch.v.y = 0; ch.onGround = true; ch.groundDie = under;
      if (wasAir && under && MODE === "stomp" && jumped) stomp(under);
      else if (wasAir && !under) { if (combo > 0) endCombo(); }
      else if (wasAir && under && MODE !== "stomp") clack(0.25);
    } else if (ch.p.y > floor + 0.05) { ch.onGround = false; ch.groundDie = null; }
    if (ch.onGround && !under && combo > 0) endCombo();
    // pose
    const moving = Math.hypot(ch.v.x, ch.v.z) > 1 && ch.onGround;
    ch.phase += dt * (moving ? 11 : 0); const sw = moving ? Math.sin(ch.phase) * 0.8 : 0;
    lLeg.rotation.x = sw; rLeg.rotation.x = -sw;
    const armUp = carried || (aiming && MODE === "throw");
    lArm.rotation.x = armUp ? Math.PI : ch.onGround ? -sw : -2.4; rArm.rotation.x = armUp ? Math.PI : ch.onGround ? sw : -2.4;
    if (aiming) rArm.rotation.x = Math.PI * 0.85 + power * 0.6;
    body.position.copy(ch.p); body.rotation.y = ch.yaw;
  }

  // ---- stomp --------------------------------------------------------------------------------
  function stomp(d) {
    if (d.anim) { ch.v.y = JUMP_V * 0.42; ch.onGround = false; return; }
    if (lastStomp && lastStomp !== d) combo++; else if (!lastStomp) combo = 1;
    lastStomp = d; comboT = 0;
    const mult = 1 + Math.min(combo - 1, 8) * 0.25;
    roll([d], { hop: 6, dur: 0.7, mult, combo });
    blip(true); ch.v.y = JUMP_V * 0.42; ch.onGround = false; shake = Math.min(1, shake + 0.12);
    if (combo >= 2) { ui.combo.textContent = `Combo x${mult.toFixed(2).replace(/\.?0+$/, "")}`; ui.combo.style.opacity = 1; }
  }
  function endCombo() { combo = 0; lastStomp = null; ui.combo.style.opacity = 0; }

  // ---- throw --------------------------------------------------------------------------------
  let aiming = false, power = 0, shot = null;
  const reticle = new T.Mesh(new T.RingGeometry(1.4, 2, 32), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }));
  reticle.rotation.x = -Math.PI / 2; reticle.renderOrder = 5; reticle.visible = false; scene.add(reticle);
  const marks = []; for (let i = 0; i < 5; i++) {
    const m = new T.Mesh(new T.PlaneGeometry(CELL * 0.92, CELL * 0.92), new T.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.4, depthTest: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 4; m.visible = false; scene.add(m); marks.push(m);
  }
  const SHOT_G = 70;
  function launchVel(p) {
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), h = 10 + 38 * p;
    return new T.Vector3(fx * h, 30, fz * h);
  }
  function predict(p) {
    const pos = ch.p.clone().add(new T.Vector3(0, 5.5, 0)), v = launchVel(p);
    for (let i = 0; i < 400; i++) {
      v.y -= SHOT_G * 0.01; pos.addScaledVector(v, 0.01);
      if (v.y < 0) { const idx = cellAt(pos.x, pos.z); if (idx >= 0 && grid[idx] && pos.y <= TOP) return { pos, idx }; if (pos.y <= 0) return { pos, idx: -1 }; }
    }
    return { pos, idx: -1 };
  }
  const plusOf = (idx) => { const r = Math.floor(idx / N), c = idx % N; return [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => a >= 0 && a < N && b >= 0 && b < N).map(([a, b]) => a * N + b); };
  function updateThrow(dt) {
    if (MODE !== "throw") return;
    if (actDown && !shot) { aiming = true; power = Math.min(1, power + dt * 1.1); }
    if (aiming) {
      const pr = predict(power); reticle.visible = true; reticle.position.copy(pr.pos).setY((pr.idx >= 0 ? TOP : 0) + 0.08);
      marks.forEach((m) => (m.visible = false));
      if (pr.idx >= 0) plusOf(pr.idx).forEach((i, k) => { const c = cellPos(i); marks[k].position.set(c.x, TOP + 0.05, c.z); marks[k].visible = true; });
      ui.power.style.opacity = 1; ui.power.firstChild.style.width = power * 100 + "%";
      if (!actDown) {
        aiming = false; reticle.visible = false; marks.forEach((m) => (m.visible = false)); ui.power.style.opacity = 0;
        const m = makeDie("white"); m.scale.setScalar(0.35); m.position.copy(ch.p).add(new T.Vector3(0, 5.5, 0));
        shot = { m, v: launchVel(power), spin: new T.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12) };
        whoosh(power); power = 0;
      }
    }
    if (shot) {
      shot.v.y -= SHOT_G * dt; shot.m.position.addScaledVector(shot.v, dt);
      shot.m.rotation.x += shot.spin.x * dt; shot.m.rotation.y += shot.spin.y * dt; shot.m.rotation.z += shot.spin.z * dt;
      const p = shot.m.position;
      if (shot.v.y < 0) {
        const idx = cellAt(p.x, p.z);
        if (idx >= 0 && grid[idx] && p.y <= TOP + 0.7) {
          const hit = plusOf(idx).map((i) => grid[i]).filter((d) => d && !d.anim);
          roll(hit, { hop: 4.5, stagger: (d) => (d.cell === idx ? 0 : 0.07), dur: 0.72 });
          clack(1); burst(p.clone(), new T.Color(0xffffff), 8); shake = Math.min(1, shake + 0.25);
          scene.remove(shot.m); shot = null;
        } else if (p.y <= 0.7) { dust(p.clone().setY(0.1), 1.5); thud(); scene.remove(shot.m); shot = null; }
      }
    }
  }

  // ---- carry --------------------------------------------------------------------------------
  let carried = null;
  const target = new T.Mesh(new T.BoxGeometry(CELL + 0.3, CELL + 0.3, CELL + 0.3), new T.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 }));
  target.visible = false; scene.add(target);
  function carryTarget() {
    const fx = Math.sin(ch.yaw), fz = Math.cos(ch.yaw);
    for (const reach of [2.6, 4.2]) { const idx = cellAt(ch.p.x + fx * reach, ch.p.z + fz * reach); if (idx >= 0 && (!ch.groundDie || grid[idx] !== ch.groundDie)) return idx; }
    return -1;
  }
  function updateCarry() {
    if (MODE !== "carry") return;
    const idx = carryTarget();
    target.visible = idx >= 0 && (carried ? true : !!grid[idx] && !grid[idx].anim);
    if (idx >= 0) { const c = cellPos(idx); target.position.set(c.x, CELL / 2, c.z); }
    if (actPressed && idx >= 0) {
      const there = grid[idx];
      if (!carried && there && !there.anim) { carried = there; grid[idx] = null; blip(true); }
      else if (carried && (!there || !there.anim)) {
        const put = carried; placeAt(put, idx); put.squash = 1; clack(0.9);
        carried = there || null; blip(false);
      }
    }
    if (carried) {
      carried.mesh.position.copy(ch.p).add(new T.Vector3(0, 6.6 + Math.sin(performance.now() / 200) * 0.1, 0));
      carried.mesh.scale.setScalar(0.5); carried.lift = 0;
    }
  }

  // ---- the clock (watch, carry) and the roll button -----------------------------------------
  let clock = 0;
  function rollBoard() {
    const dice = grid.filter((d) => d && !d.anim);
    roll(dice, { scope: "all", hop: 4.5, stagger: (d) => ((d.cell % N) + Math.floor(d.cell / N)) * 0.05 });
  }
  function updateClock(dt) {
    if (!AUTO) return;
    clock += dt;
    if (MODE === "watch" && actPressed && clock > 1.2) clock = AUTO;
    if (clock >= AUTO) { clock = 0; rollBoard(); }
    if (barFill) barFill.style.width = (clock / AUTO) * 100 + "%";
  }

  // ---- frame --------------------------------------------------------------------------------
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  addEventListener("resize", resize); resize();
  const camTarget = new T.Vector3();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    step(dt);
    requestAnimationFrame(frame);
  }
  function step(dt) {
    moveChar(dt); updateThrow(dt); updateCarry(); updateClock(dt); actPressed = false;
    updateDice(dt); updateFx(dt);
    if (combo > 0) { comboT += dt; }
    camTarget.lerp(ch.p.clone().add(new T.Vector3(0, 4.5, 0)), Math.min(1, dt * 12));
    const cp = Math.cos(cam.pitch);
    camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * cp * cam.dist);
    camera.lookAt(camTarget);
    if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.9; camera.position.y += (Math.random() - 0.5) * shake * 0.9; shake = Math.max(0, shake - dt * 2.5); }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  // a hook for shots and checks
  window.__game = {
    step, roll: rollBoard, at(x, z, yaw, y) { ch.p.set(x, y || 0, z); if (yaw !== undefined) ch.yaw = yaw; camTarget.copy(ch.p).add(new T.Vector3(0, 4.5, 0)); },
    cam(yaw, pitch, dist) { cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; },
    set(nums) { nums.forEach((n, i) => { if (grid[i] && n) { grid[i].num = n; grid[i].mesh.quaternion.copy(orientFor(n)); } }); },
    stompAt(idx) { stomp(grid[idx]); },
    throwAt(p) { actDown = true; power = p; aiming = true; },
    lift() { actPressed = true; },
    release() { actDown = false; },
    hands: findHands, get points() { return points; }, grid,
  };
})();
