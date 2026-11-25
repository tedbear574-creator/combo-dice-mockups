// Combo Dice: the dice workshop. Your plot has a board that rolls itself and machines you carry dice between:
// the press makes blank dice, the stamp sets a face to its number, the kiln fires a die into a better material,
// the melter takes a die back for points. A machine in the plaza tips dice out for the whole server; rare ones
// (Wild, Lava) are announced, and two other players race you for them. Rules: workshop-rules.js.
// Distances in studs, Roblox's gravity, walk speed and jump, and its 70 degree camera.
(function () {
  "use strict";
  const T = window.THREE, WS = window.WS;
  const N = WS.N, CELL = 4, GAP = 0.5, PITCH = CELL + GAP, TOP = CELL;
  const G = 196.2, WALK = 16, JUMP_V = 53.2, RADIUS = 0.9;
  const LOOSE = 0.6; // a die off the board (on a tray, the plaza, the ground) at this scale
  const LOOSE_H = (CELL * LOOSE) / 2;
  const rand = (n) => Math.floor(Math.random() * n);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  // ---- the look of a die's material --------------------------------------------------------------
  const LOOK = {
    stone: { body: "#f3efe6", edge: "#d9d2c3", ink: "#1f2633", metal: 0, rough: 0.45, glow: 0xffffff },
    iron: { body: "#a7b0ba", edge: "#6d757e", ink: "#1d232b", metal: 0.75, rough: 0.32, glow: 0xcfe3ff },
    gold: { body: "#f5c84f", edge: "#c2902a", ink: "#4a3208", metal: 0.9, rough: 0.22, glow: 0xffd040 },
    glass: { body: "#c9f2ff", edge: "#7fcbe8", ink: "#0b4766", metal: 0, rough: 0.04, glow: 0x9be8ff, opacity: 0.78 },
    lava: { body: "#3b1c14", edge: "#170805", ink: "#ffb347", metal: 0.1, rough: 0.6, glow: 0xff7a2a, emissive: 0xff6a1a },
  };

  // ---- page ----------------------------------------------------------------------------------------
  const css = document.createElement("style");
  css.textContent = `
  html,body{margin:0;height:100%;overflow:hidden;background:#9fd3ff;font-family:"Arial Black","Segoe UI",Arial,sans-serif;
    user-select:none;-webkit-user-select:none;touch-action:none}
  canvas{display:block}
  .hud{position:fixed;pointer-events:none;color:#fff;text-shadow:0 2px 0 #1b2a44,0 0 6px rgba(0,0,0,.35)}
  #points{top:12px;left:50%;transform:translateX(-50%);font-size:40px;letter-spacing:1px;transition:transform .08s}
  #points.bump{transform:translateX(-50%) scale(1.18)}
  #sub{top:62px;left:50%;transform:translateX(-50%);font-size:15px;display:flex;gap:14px;align-items:center;white-space:nowrap}
  .bar{width:90px;height:8px;border-radius:4px;background:rgba(0,0,0,.25);overflow:hidden;display:inline-block;vertical-align:middle;margin-left:6px}
  .bar i{display:block;height:100%;background:#ffe066;width:0}
  #dropbar i{background:#ff9cf0}
  #modes{top:10px;left:10px;display:flex;gap:6px;pointer-events:auto}
  #modes a{font-size:13px;padding:6px 10px;border-radius:8px;background:rgba(20,30,50,.55);color:#fff;text-decoration:none;text-shadow:none}
  #modes a.on{background:#ffd040;color:#22201a}
  #keys{bottom:10px;left:12px;font-size:12px;font-family:"Segoe UI",Arial,sans-serif;font-weight:700;opacity:.9}
  #prompt{bottom:92px;left:50%;transform:translateX(-50%);font-size:20px;white-space:nowrap}
  #prompt .k{display:inline-block;background:#fff;color:#1b2a44;text-shadow:none;border-radius:6px;padding:0 8px;margin-right:8px}
  #prompt.no{color:#ff8a80}
  #faces{bottom:36px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center}
  #faces span{width:40px;height:40px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:24px;
    text-shadow:none;box-shadow:inset 0 -3px 0 rgba(0,0,0,.25)}
  #faces em{font-style:normal;font-size:15px;margin-left:6px}
  #banner{top:96px;left:50%;transform:translateX(-50%) scale(.8);font-size:26px;color:#ff9cf0;opacity:0;white-space:nowrap;text-align:center}
  #banner small{display:block;font-size:16px;color:#fff}
  .float{position:fixed;pointer-events:none;transform:translate(-50%,-50%);white-space:nowrap;text-align:center;
    color:#fff;text-shadow:0 2px 0 #1b2a44,0 0 8px rgba(0,0,0,.4);font-size:20px;line-height:1.05}
  .float b{display:block;font-size:26px;color:#ffe066}
  .float.straight b{color:#7fe8ff}
  .float.set b{color:#ff9cf0}
  .float.note{font-size:18px}
  #total{top:34%;left:50%;transform:translate(-50%,-50%) scale(.6);font-size:64px;opacity:0;color:#ffe066}
  .tag{position:fixed;pointer-events:none;transform:translate(-50%,-100%);font-size:14px;color:#fff;white-space:nowrap;
    text-shadow:0 2px 0 #1b2a44;text-align:center;line-height:1.1}
  .tag b{display:block;font-size:22px}
  .btn{position:fixed;pointer-events:auto;border-radius:50%;background:rgba(20,30,50,.45);color:#fff;font-size:13px;text-align:center;
    display:none;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,.5)}
  #jump{right:24px;bottom:28px;width:84px;height:84px}
  #act{right:118px;bottom:40px;width:74px;height:74px}
  #stick{position:fixed;left:30px;bottom:30px;width:120px;height:120px;border-radius:50%;background:rgba(20,30,50,.25);
    border:2px solid rgba(255,255,255,.35);display:none;pointer-events:none}
  #stick i{position:absolute;left:40px;top:40px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.6)}
  body.touch .btn{display:flex} body.touch #stick{display:block} body.touch #keys{display:none} body.touch #prompt .k{display:none}
  body.touch #prompt{bottom:214px} body.touch #faces{bottom:160px} body.touch #faces span{width:32px;height:32px;font-size:19px}
  @media (max-width:600px){#modes a{font-size:11px;padding:4px 7px} #points{top:40px;font-size:34px} #sub{top:84px} #banner{top:110px;font-size:20px}}
  `;
  document.head.appendChild(css);
  const html = (s) => { const d = document.createElement("div"); d.innerHTML = s.trim(); return d.firstChild; };
  const add = (s) => document.body.appendChild(html(s));
  const ui = {
    points: add(`<div class="hud" id="points">0</div>`),
    sub: add(`<div class="hud" id="sub"><span>Roll<span class="bar" id="rollbar"><i></i></span></span><span>Drop<span class="bar" id="dropbar"><i></i></span></span></div>`),
    modes: add(`<div class="hud" id="modes">${["watch", "stomp", "throw", "carry"].map((m) => `<a href="${m}.html">${m[0].toUpperCase() + m.slice(1)}</a>`).join("")}<a class="on" href="workshop.html">Workshop</a></div>`),
    keys: add(`<div class="hud" id="keys">WASD move · Space jump · drag to look · E lift / use · P +1,000 points</div>`),
    prompt: add(`<div class="hud" id="prompt"></div>`),
    faces: add(`<div class="hud" id="faces"></div>`),
    banner: add(`<div class="hud" id="banner"></div>`),
    total: add(`<div class="hud" id="total"></div>`),
    jump: add(`<div class="btn" id="jump">Jump</div>`),
    act: add(`<div class="btn" id="act">Lift</div>`),
    stick: add(`<div id="stick"><i></i></div>`),
  };
  const rollFill = document.querySelector("#rollbar i"), dropFill = document.querySelector("#dropbar i");

  // ---- sound ---------------------------------------------------------------------------------------
  let ac = null, master = null, noiseBuf = null, lastClack = 0;
  function audio() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return; }
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function tone(type, f0, f1, dur, vol, at) {
    if (!ac) return; const now = ac.currentTime + (at || 0); const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, now); if (f1) o.frequency.exponentialRampToValueAtTime(f1, now + dur);
    const g = ac.createGain(); env(g, now, 0.004, vol, dur); o.connect(g).connect(master); o.start(now); o.stop(now + dur + 0.05);
  }
  function noise(f0, f1, q, dur, vol, at) {
    if (!ac) return; const now = ac.currentTime + (at || 0); const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = q; bp.frequency.setValueAtTime(f0, now);
    if (f1) bp.frequency.exponentialRampToValueAtTime(f1, now + dur);
    const g = ac.createGain(); env(g, now, 0.01, vol, dur); src.connect(bp).connect(g).connect(master); src.start(now); src.stop(now + dur + 0.05);
  }
  function clack(level = 1) {
    if (!ac) return; const now = ac.currentTime; if (now - lastClack < 0.025) return; lastClack = now;
    noise(1800 + Math.random() * 1400, 0, 3, 0.07, 0.5 * level); tone("sine", 220 + Math.random() * 60, 90, 0.09, 0.35 * level);
  }
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
  function chime(step, big) {
    if (!ac) return; const f = 392 * Math.pow(2, SCALE[Math.min(step, SCALE.length - 1)] / 12);
    tone("triangle", f, 0, big ? 0.9 : 0.45, 0.28); tone("sine", f * 2, 0, big ? 0.9 : 0.45, 0.1); if (big) tone("sine", f * 1.5, 0, 0.9, 0.12);
  }
  function fanfare(n) { [0, 4, 7, 12].slice(0, n >= 3 ? 4 : 3).forEach((s, i) => tone("square", 523 * Math.pow(2, s / 12), 0, 0.6, 0.06, i * 0.06)); }
  const thud = () => tone("sine", 140, 70, 0.18, 0.18);
  const blip = (up) => tone("triangle", up ? 500 : 700, up ? 900 : 400, 0.1, 0.15);
  const buzz = () => tone("square", 160, 120, 0.18, 0.08);
  const stampSnd = () => { noise(600, 200, 1, 0.12, 0.6); tone("sine", 90, 50, 0.2, 0.5); tone("triangle", 1200, 0, 0.25, 0.08, 0.08); };
  const fireSnd = () => { noise(300, 900, 0.7, 1.1, 0.3); tone("sine", 70, 140, 1.0, 0.15); };
  const meltSnd = () => { noise(1200, 200, 2, 0.6, 0.3); tone("sine", 300, 80, 0.5, 0.15); };
  const pressSnd = () => { noise(400, 0, 2, 0.06, 0.3); tone("triangle", 330, 440, 0.08, 0.1); };
  const rumble = () => { noise(80, 160, 1, 1.4, 0.35); };
  const rare = () => { [0, 7, 12, 16, 19].forEach((s, i) => tone("triangle", 660 * Math.pow(2, s / 12), 0, 0.5, 0.12, i * 0.07)); };

  // ---- scene ---------------------------------------------------------------------------------------
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  document.body.prepend(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color(0x9fd3ff); scene.fog = new T.Fog(0x9fd3ff, 160, 380);
  const camera = new T.PerspectiveCamera(70, 1, 0.1, 1000);
  scene.add(new T.HemisphereLight(0xe6f4ff, 0x6f8f55, 1.1));
  const sun = new T.DirectionalLight(0xffffff, 1.9); sun.position.set(35, 70, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 220 });
  sun.shadow.bias = -0.0005; scene.add(sun); scene.add(sun.target);
  const mat = (color, o) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.8 }, o || {}));
  const ground = new T.Mesh(new T.PlaneGeometry(900, 900), mat(0x67a84c, { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const slab = (w, d, color, x, z, y) => { const m = new T.Mesh(new T.BoxGeometry(w, 0.3, d), mat(color, { roughness: 0.9 })); m.position.set(x, (y || 0.1) - 0.15, z); m.receiveShadow = true; scene.add(m); return m; };
  slab(64, 60, 0xd8cdb4, 0, 2); // your plot
  slab(N * PITCH + 1.2, N * PITCH + 1.2, 0x5b4636, 0, 0, 0.2); // the board's bed
  slab(10, 34, 0xcfc4aa, 0, -45); // the path to the plaza
  const PLAZA = new T.Vector3(0, 0, -95);
  const plazaDisc = new T.Mesh(new T.CylinderGeometry(42, 42, 0.3, 48), mat(0xe3d9c4, { roughness: 0.9 }));
  plazaDisc.position.set(PLAZA.x, -0.04, PLAZA.z); plazaDisc.receiveShadow = true; scene.add(plazaDisc);
  const trunkM = mat(0x7a5232), leafM = mat(0x3f8f3a, { roughness: 0.9 });
  [[-40, -26], [42, -24], [-44, 30], [44, 34], [-62, 4], [64, -2], [-30, -140], [34, -142], [-80, -120], [86, -118]].forEach(([x, z]) => {
    const t = new T.Mesh(new T.CylinderGeometry(0.8, 1, 8), trunkM); t.position.set(x, 4, z); t.castShadow = true; scene.add(t);
    const l = new T.Mesh(new T.SphereGeometry(5, 12, 10), leafM); l.position.set(x, 10, z); l.castShadow = true; scene.add(l);
  });

  // signs: a word on a board above a machine
  function sign(text, x, y, z, w, color) {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128; const g = cv.getContext("2d");
    g.fillStyle = color || "#2b3a55"; g.beginPath(); g.roundRect(4, 4, 504, 120, 28); g.fill();
    g.fillStyle = "#fff"; g.font = "900 72px 'Arial Black', Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 256, 68);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthWrite: false })); s.scale.set(w || 8, (w || 8) / 4, 1); s.position.set(x, y, z); scene.add(s);
    s.redraw = (t2, c2) => { g.clearRect(0, 0, 512, 128); g.fillStyle = c2 || color || "#2b3a55"; g.beginPath(); g.roundRect(4, 4, 504, 120, 28); g.fill();
      g.fillStyle = "#fff"; g.fillText(t2, 256, 68); tex.needsUpdate = true; };
    return s;
  }

  // ---- dice ----------------------------------------------------------------------------------------
  function roundedBox(size, r, seg) {
    const g = new T.BoxGeometry(size, size, size, seg, seg, seg); const p = g.attributes.position, nrm = g.attributes.normal;
    const h = size / 2, inner = h - r, v = new T.Vector3(), c = new T.Vector3(), d = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); c.set(clamp(v.x, -inner, inner), clamp(v.y, -inner, inner), clamp(v.z, -inner, inner));
      d.subVectors(v, c);
      if (d.lengthSq() > 1e-9) { d.normalize(); v.copy(c).addScaledVector(d, r); p.setXYZ(i, v.x, v.y, v.z); nrm.setXYZ(i, d.x, d.y, d.z); }
    }
    p.needsUpdate = true; nrm.needsUpdate = true; return g;
  }
  const DIE_GEO = roundedBox(CELL, 0.55, 12);
  const SLOT_NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]; // BoxGeometry face order
  const texCache = {};
  function faceTex(n, m, kind) {
    const key = n + m + kind; if (texCache[key]) return texCache[key];
    const c = LOOK[m], cv = document.createElement("canvas"); cv.width = cv.height = 256; const x = cv.getContext("2d");
    x.fillStyle = c.edge; x.fillRect(0, 0, 256, 256);
    if (kind === "wild") {
      const gr = x.createLinearGradient(0, 0, 256, 256); ["#ff6a8a", "#ffb347", "#ffe066", "#7cf09a", "#6aa8ff", "#c07cff"].forEach((s, i) => gr.addColorStop(i / 5, s));
      x.fillStyle = gr; x.beginPath(); x.roundRect(10, 10, 236, 236, 46); x.fill();
      x.font = "900 170px Arial"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "rgba(0,0,0,.25)"; x.fillText("★", 131, 143);
      x.fillStyle = "#fff"; x.fillText("★", 128, 138);
    } else {
      const gr = x.createRadialGradient(128, 118, 20, 128, 128, 170); gr.addColorStop(0, c.body); gr.addColorStop(0.75, c.body); gr.addColorStop(1, c.edge);
      x.fillStyle = gr; x.beginPath(); x.roundRect(10, 10, 236, 236, 46); x.fill();
      if (m === "lava") { x.strokeStyle = "#ff7a2a"; x.lineWidth = 5; x.beginPath(); x.moveTo(30, 60); x.lineTo(80, 90); x.lineTo(70, 140); x.moveTo(200, 30); x.lineTo(180, 80); x.lineTo(226, 120); x.moveTo(40, 210); x.lineTo(100, 196); x.stroke(); }
      if (m === "glass") { x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.ellipse(70, 60, 40, 16, -0.6, 0, Math.PI * 2); x.fill(); }
      if (kind === "weighted") { x.fillStyle = "#3a5f8f"; x.beginPath(); x.roundRect(20, 20, 216, 216, 40); x.lineWidth = 12; x.strokeStyle = "#3a5f8f"; x.stroke(); }
      x.font = "900 150px 'Arial Black', Arial, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillStyle = "rgba(0,0,0,.28)"; x.fillText(String(n), 131, 141);
      x.fillStyle = "rgba(255,255,255,.35)"; x.fillText(String(n), 126, 134);
      x.fillStyle = c.ink; x.fillText(String(n), 128, 137);
      if (n === 6 || n === 9) x.fillRect(96, 210, 64, 10);
    }
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; texCache[key] = t; return t;
  }
  function dress(d) {
    const look = LOOK[d.mat];
    d.mesh.material.forEach((m, slot) => {
      m.map = faceTex(d.faces[slot], d.mat, d.kind); m.metalness = look.metal; m.roughness = look.rough;
      m.transparent = !!look.opacity; m.opacity = look.opacity || 1;
      m.emissiveMap = look.emissive ? m.map : null; d.baseEmissive = look.emissive ? new T.Color(look.emissive).multiplyScalar(0.9) : new T.Color(0);
      m.needsUpdate = true;
    });
  }
  function orientSlot(slot) {
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(...SLOT_NORMALS[slot]), new T.Vector3(0, 1, 0));
    if (slot === 3) q.setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI);
    return new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), (rand(4) * Math.PI) / 2).multiply(q);
  }
  const allDice = [];
  function makeDie(kind) {
    const d = Object.assign(WS.newDie(kind), { slot: 2, num: 0, where: "loose", cell: -1, pos: new T.Vector3(), anim: null, fly: null,
      glow: 0, glowColor: new T.Color(), lift: 0, squash: 0, spin: 0 });
    d.mesh = new T.Mesh(DIE_GEO, d.faces.map(() => new T.MeshStandardMaterial({ roughness: 0.42 })));
    d.mesh.castShadow = true; d.mesh.receiveShadow = true; scene.add(d.mesh);
    dress(d); d.slot = rand(6); d.num = d.faces[d.slot]; d.mesh.quaternion.copy(orientSlot(d.slot));
    allDice.push(d); return d;
  }
  function removeDie(d) { scene.remove(d.mesh); allDice.splice(allDice.indexOf(d), 1); if (d.cell >= 0 && grid[d.cell] === d) grid[d.cell] = null; d.where = "gone"; }
  const cellX = (i) => (i - (N - 1) / 2) * PITCH;
  const grid = Array(N * N).fill(null);
  const cellPos = (idx) => new T.Vector3(cellX(idx % N), 0, cellX(Math.floor(idx / N)));
  function cellAt(x, z) {
    const c = Math.round(x / PITCH + (N - 1) / 2), r = Math.round(z / PITCH + (N - 1) / 2);
    if (c < 0 || c >= N || r < 0 || r >= N) return -1;
    if (Math.abs(x - cellX(c)) > CELL / 2 + GAP / 2 || Math.abs(z - cellX(r)) > CELL / 2 + GAP / 2) return -1;
    return r * N + c;
  }
  function putOnBoard(d, idx) { d.where = "board"; d.cell = idx; grid[idx] = d; d.mesh.scale.setScalar(1); d.squash = 1; }
  function putLoose(d, pos) { d.where = "loose"; d.cell = -1; d.pos.copy(pos).setY(LOOSE_H); d.mesh.scale.setScalar(LOOSE); }
  // a die flies along an arc to a spot and lands showing a fresh face
  function flyTo(d, to, opts = {}) {
    d.slot = rand(6); d.num = d.faces[d.slot];
    d.fly = { t: 0, dur: opts.dur || 0.7, from: (opts.from || d.mesh.position).clone(), to: to.clone(), h: opts.h || 6, q0: d.mesh.quaternion.clone(),
      q1: orientSlot(d.slot), axis: new T.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize(), turns: 3 + Math.random() * 4, done: opts.done };
  }

  // the starting board: six stone dice in the middle
  [6, 7, 8, 11, 12, 13].forEach((i) => putOnBoard(makeDie("plain"), i));

  // ---- machines ------------------------------------------------------------------------------------
  const colliders = []; // { x0, x1, z0, z1, top }
  function block(w, h, d, color, x, z, y0, o) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color, o)); m.position.set(x, (y0 || 0) + h / 2, z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    return m;
  }
  const collide = (x, z, w, d, top) => colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, top });
  const machines = {};
  // the press: a die every few seconds onto its tray, up to four
  {
    const x = -24, z = 2;
    block(6, 7, 6, 0x4a6fa5, x, z); block(4, 1, 4, 0x2b3a55, x, z, 7); block(1.2, 3, 1.2, 0x9aa3ad, x, z, 8);
    collide(x, z, 6, 6, 7);
    const tray = block(3.6, 0.6, 13, 0x7a8796, x + 5, z); collide(x + 5, z, 3.6, 13, 0.6);
    const slots = [-4.5, -1.5, 1.5, 4.5].map((dz) => new T.Vector3(x + 5, 0.6, z + dz));
    machines.press = { name: "Press", pos: new T.Vector3(x + 5, 0, z), use: 0, t: 0, slots, held: [null, null, null, null], sign: sign("PRESS", x, 11, z, 5.5, "#4a6fa5") };
  }
  // the stamp: a plate under a plunger; the dial pad beside it turns its number
  {
    const x = -14, z = 22;
    block(6, 2.4, 6, 0x6b4f8a, x, z); const plate = block(3.4, 0.3, 3.4, 0x2b2233, x, z, 2.4);
    block(0.8, 8, 0.8, 0x3a3046, x - 2.6, z - 2.6); block(0.8, 8, 0.8, 0x3a3046, x + 2.6, z - 2.6); block(6, 1, 1.2, 0x3a3046, x, z - 2.6, 8);
    const plunger = new T.Group(); plunger.position.set(x, 7.6, z); scene.add(plunger);
    const head = new T.Mesh(new T.BoxGeometry(3.2, 1.2, 3.2), mat(0x9aa3ad, { metalness: 0.7, roughness: 0.3 })); head.position.y = -0.6; head.castShadow = true; plunger.add(head);
    const rod = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 3), mat(0x6d757e, { metalness: 0.7 })); rod.position.y = 1; plunger.add(rod);
    collide(x, z, 6, 6, 2.4);
    const dial = block(3.2, 0.3, 3.2, 0xffd040, x + 7, z + 1); dial.material.emissive = new T.Color(0x332200);
    machines.stamp = { name: "Stamp", pos: new T.Vector3(x, 0, z), plate: new T.Vector3(x, 2.7, z), plunger, num: 6, use: 0,
      dialPos: new T.Vector3(x + 7, 0, z + 1), onDial: false, sign: sign("STAMP 6", x, 10.5, z, 6, "#6b4f8a"), dialSign: sign("NUMBER", x + 7, 2.6, z + 1, 3.6, "#c99a17") };
  }
  // the kiln: a dome with a glowing mouth
  {
    const x = 14, z = 22;
    block(7, 4, 7, 0x8a4a2f, x, z);
    const dome = new T.Mesh(new T.SphereGeometry(3.6, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x9c5a3c)); dome.position.set(x, 4, z); dome.castShadow = true; scene.add(dome);
    block(1.2, 5, 1.2, 0x5b3a28, x + 2, z - 2, 6);
    const mouth = new T.Mesh(new T.PlaneGeometry(3, 2.2), new T.MeshBasicMaterial({ color: 0xff7a2a })); mouth.position.set(x, 2, z + 3.52); scene.add(mouth);
    const light = new T.PointLight(0xff7a2a, 0, 18); light.position.set(x, 3, z + 5); scene.add(light);
    collide(x, z, 7, 7, 7.6);
    machines.kiln = { name: "Kiln", pos: new T.Vector3(x, 0, z), mouth: new T.Vector3(x, 2, z + 3.2), light, mouthMesh: mouth, use: 0, sign: sign("KILN", x, 12, z, 5.5, "#8a4a2f") };
  }
  // the melter: a vat that takes a die back for points
  {
    const x = 24, z = 2;
    const vat = new T.Mesh(new T.CylinderGeometry(3.6, 3.2, 3, 24), mat(0x4b5563, { metalness: 0.5, roughness: 0.4 })); vat.position.set(x, 1.5, z); vat.castShadow = true; scene.add(vat);
    const pool = new T.Mesh(new T.CircleGeometry(3.1, 24), new T.MeshBasicMaterial({ color: 0x46e0c0 })); pool.rotation.x = -Math.PI / 2; pool.position.set(x, 2.9, z); scene.add(pool);
    collide(x, z, 7, 7, 3);
    machines.melter = { name: "Melter", pos: new T.Vector3(x, 0, z), mouth: new T.Vector3(x, 3, z), pool, use: 0, sign: sign("MELTER", x, 7.5, z, 5.5, "#3f6f68") };
  }
  // the drop machine in the plaza: a big hopper whose chute faces your plot
  {
    const p = PLAZA;
    block(12, 16, 12, 0xd9534f, p.x, p.z - 8); block(14, 2, 14, 0xf4c430, p.x, p.z - 8, 16);
    const chute = block(5, 2, 8, 0xb8322a, p.x, p.z - 0.5, 4); chute.rotation.x = -0.35;
    collide(p.x, p.z - 8, 12, 12, 18);
    machines.drop = { mouth: new T.Vector3(p.x, 6, p.z + 2), t: WS.DROP.every - 8, warned: false, sign: sign("DICE DROP", p.x, 22, p.z - 8, 14, "#d9534f") };
  }

  // ---- other players: two neighbours with their own plots who race you for drops ------------------
  const homes = [new T.Vector3(-70, 0, -70), new T.Vector3(70, 0, -72)];
  homes.forEach((h) => { slab(30, 30, 0xd8cdb4, h.x, h.z); slab(3 * PITCH + 1.2, 3 * PITCH + 1.2, 0x5b4636, h.x, h.z, 0.2); });
  const homeDice = homes.map((h) => {
    const list = [];
    for (let i = 0; i < 9; i++) { const d = makeDie(i % 3 ? "plain" : "gold"); d.where = "home"; d.mesh.position.set(h.x + ((i % 3) - 1) * PITCH, CELL / 2, h.z + (Math.floor(i / 3) - 1) * PITCH); list.push(d); }
    return list;
  });
  function avatar(shirt, legs, head) {
    const g = new T.Group(); scene.add(g);
    const box = (w, h, d, color, x, y, z, parent) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color, { roughness: 0.7 })); m.position.set(x, y, z); m.castShadow = true; (parent || g).add(m); return m; };
    const joint = (x, y, z) => { const j = new T.Group(); j.position.set(x, y, z); g.add(j); return j; };
    box(2, 2, 1, shirt, 0, 3, 0); box(1.2, 1.2, 1.2, head, 0, 4.6, 0);
    const lArm = joint(-1.5, 4, 0), rArm = joint(1.5, 4, 0), lLeg = joint(-0.5, 2, 0), rLeg = joint(0.5, 2, 0);
    box(1, 2, 1, head, 0, -1, 0, lArm); box(1, 2, 1, head, 0, -1, 0, rArm); box(1, 2, 1, legs, 0, -1, 0, lLeg); box(1, 2, 1, legs, 0, -1, 0, rLeg);
    return { g, lArm, rArm, lLeg, rLeg, phase: 0 };
  }
  function pose(a, moving, carrying, dt) {
    a.phase += dt * (moving ? 11 : 0); const sw = moving ? Math.sin(a.phase) * 0.8 : 0;
    a.lLeg.rotation.x = sw; a.rLeg.rotation.x = -sw;
    a.lArm.rotation.x = carrying ? Math.PI : -sw; a.rArm.rotation.x = carrying ? Math.PI : sw;
  }
  const bots = homes.map((h, i) => ({ name: ["Mia", "Zed"][i], home: h, p: h.clone().add(new T.Vector3(0, 0, 14)), yaw: 0, state: "home", wait: 0, target: null, carrying: null,
    av: avatar([0xd9534f, 0x3daf5b][i], 0x2b3a55, [0xf1c27d, 0x8d5524][i]), tag: add(`<div class="tag">${["Mia", "Zed"][i]}</div>`) }));

  // ---- you -----------------------------------------------------------------------------------------
  const ch = { p: new T.Vector3(0, 0, 17), v: new T.Vector3(), yaw: Math.PI, onGround: true, jumped: false, busy: 0 };
  const me = avatar(0x2f6fd0, 0x3c8f3c, 0xf5cd30);
  let carried = null;
  let points = 0, shown = 0, shake = 0, stamps = 0;
  const fired = {};

  // ---- input ---------------------------------------------------------------------------------------
  const keys = {}; const cam = { yaw: 0, pitch: 0.5, dist: 26 };
  const stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
  let jumpQueued = false, actPressed = false;
  addEventListener("keydown", (e) => {
    audio(); if (e.repeat) return; keys[e.code] = true;
    if (e.code === "Space") jumpQueued = true;
    if (e.code === "KeyE") actPressed = true;
    if (e.code === "KeyP") { points += 1000; blip(true); }
  });
  addEventListener("keyup", (e) => { keys[e.code] = false; });
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
  canvas.addEventListener("wheel", (e) => { cam.dist = clamp(cam.dist * (e.deltaY > 0 ? 1.1 : 0.9), 8, 70); e.preventDefault(); }, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  ui.jump.addEventListener("pointerdown", (e) => { audio(); jumpQueued = true; e.preventDefault(); });
  ui.act.addEventListener("pointerdown", (e) => { audio(); actPressed = true; e.preventDefault(); });

  // ---- moving --------------------------------------------------------------------------------------
  function solids() {
    const out = colliders.slice();
    for (let i = 0; i < N * N; i++) if (grid[i]) { const c = cellPos(i); out.push({ x0: c.x - CELL / 2, x1: c.x + CELL / 2, z0: c.z - CELL / 2, z1: c.z + CELL / 2, top: TOP }); }
    return out;
  }
  const slowFor = (d) => (d && (d.kind === "wild" || d.mat === "lava") ? 0.7 : d ? 0.88 : 1);
  function moveChar(dt) {
    let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stick.x;
    let iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + stick.y;
    const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
    if (ch.busy > 0) { ix = iz = 0; }
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    const mx = rx * ix - fx * iz, mz = rz * ix - fz * iz, speed = WALK * slowFor(carried);
    ch.v.x = mx * speed; ch.v.z = mz * speed;
    if (Math.hypot(mx, mz) > 0.1) { const target = Math.atan2(mx, mz); let dy = target - ch.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.yaw += dy * Math.min(1, dt * 14); }
    if (jumpQueued && ch.onGround && ch.busy <= 0) { ch.v.y = JUMP_V; ch.onGround = false; }
    jumpQueued = false;
    ch.v.y -= G * dt; ch.p.addScaledVector(ch.v, dt);
    const S = solids(); let floor = 0;
    for (const s of S) {
      const over = ch.p.x > s.x0 - RADIUS * 0.5 && ch.p.x < s.x1 + RADIUS * 0.5 && ch.p.z > s.z0 - RADIUS * 0.5 && ch.p.z < s.z1 + RADIUS * 0.5;
      if (ch.p.y >= s.top - 0.6) { if (over) floor = Math.max(floor, s.top); continue; }
      const nx = clamp(ch.p.x, s.x0, s.x1), nz = clamp(ch.p.z, s.z0, s.z1); const dx = ch.p.x - nx, dz = ch.p.z - nz, dist = Math.hypot(dx, dz);
      if (dist < RADIUS) {
        if (dist > 1e-6) { ch.p.x = nx + (dx / dist) * RADIUS; ch.p.z = nz + (dz / dist) * RADIUS; }
        else { const px = Math.min(ch.p.x - s.x0, s.x1 - ch.p.x), pz = Math.min(ch.p.z - s.z0, s.z1 - ch.p.z);
          if (px < pz) ch.p.x = ch.p.x - s.x0 < s.x1 - ch.p.x ? s.x0 - RADIUS : s.x1 + RADIUS; else ch.p.z = ch.p.z - s.z0 < s.z1 - ch.p.z ? s.z0 - RADIUS : s.z1 + RADIUS; }
      }
    }
    if (ch.p.y <= floor && ch.v.y <= 0) { if (!ch.onGround && floor > 0) clack(0.25); ch.p.y = floor; ch.v.y = 0; ch.onGround = true; }
    else if (ch.p.y > floor + 0.05) ch.onGround = false;
    pose(me, Math.hypot(ch.v.x, ch.v.z) > 1 && ch.onGround, !!carried || ch.busy > 0, dt);
    if (!ch.onGround) { me.lArm.rotation.x = carried ? Math.PI : -2.4; me.rArm.rotation.x = carried ? Math.PI : -2.4; }
    me.g.position.copy(ch.p); me.g.rotation.y = ch.yaw;
    // the dial pad turns the stamp's number when you step onto it
    const st = machines.stamp, on = Math.abs(ch.p.x - st.dialPos.x) < 1.9 && Math.abs(ch.p.z - st.dialPos.z) < 1.9 && ch.p.y < 1;
    if (on && !st.onDial) { st.num = (st.num % 6) + 1; st.sign.redraw(`STAMP ${st.num}`); blip(true); }
    st.onDial = on;
  }

  // ---- what E does here ----------------------------------------------------------------------------
  const ahead = (reach) => new T.Vector3(ch.p.x + Math.sin(ch.yaw) * reach, 0, ch.p.z + Math.cos(ch.yaw) * reach);
  function boardTarget() {
    for (const reach of [2.6, 4.2]) { const a = ahead(reach), idx = cellAt(a.x, a.z); if (idx >= 0) return idx; }
    return -1;
  }
  function nearMachine() {
    let best = null, bd = 7.5;
    for (const k of ["stamp", "kiln", "melter"]) { const m = machines[k], d = Math.hypot(ch.p.x - m.pos.x, ch.p.z - m.pos.z); if (d < bd) { bd = d; best = k; } }
    return best;
  }
  function nearLoose() {
    let best = null, bd = 4.2; const a = ahead(1.6);
    for (const d of allDice) {
      if (d.where !== "loose" || d.fly) continue;
      const dist = Math.hypot(d.pos.x - a.x, d.pos.z - a.z); if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }
  // the action E would take now: { label, cost, can, run }
  function plan() {
    if (ch.busy > 0) return null;
    if (carried) {
      const m = nearMachine();
      if (m === "stamp") {
        const n = machines.stamp.num, cost = WS.stampCost(carried, n, stamps);
        if (cost === null) return { label: carried.kind === "wild" ? "Wild dice can't be stamped" : `Every face is ${n}`, can: false };
        return { label: `Stamp a ${n}`, cost, can: points >= cost, run: () => useStamp(cost) };
      }
      if (m === "kiln") {
        const to = WS.nextMat(carried), cost = WS.fireCost(carried, fired);
        if (!to) return { label: "Lava is the top", can: false };
        return { label: `Fire to ${WS.MAT[to].name}`, cost, can: points >= cost, run: () => useKiln(cost) };
      }
      if (m === "melter") { const v = WS.meltValue(carried); return { label: `Melt for ${fmt(v)}`, can: true, run: () => useMelter(v) }; }
      const idx = boardTarget();
      if (idx >= 0) {
        const there = grid[idx];
        if (there && there.anim) return null;
        return { label: there ? "Swap" : "Put down", can: true, run: () => {
          const put = carried; carried = there || null; if (there) { grid[idx] = null; there.where = "carried"; }
          putOnBoard(put, idx); clack(0.9); blip(false);
        } };
      }
      return { label: "Drop", can: true, run: () => { const d = carried; carried = null; putLoose(d, ahead(2.4)); clack(0.5); } };
    }
    const loose = nearLoose(), idx = boardTarget();
    if (loose) return { label: "Lift", can: true, run: () => lift(loose) };
    if (idx >= 0 && grid[idx] && !grid[idx].anim) return { label: "Lift", can: true, run: () => { const d = grid[idx]; grid[idx] = null; d.cell = -1; lift(d); } };
    return null;
  }
  function lift(d) {
    const tray = machines.press.held.indexOf(d); if (tray >= 0) machines.press.held[tray] = null;
    if (d.drop) { d.drop = false; }
    d.where = "carried"; d.cell = -1; carried = d; blip(true);
  }
  function spend(c) { points -= c; carried.spent += c; }
  // a machine takes the die out of your hands, works on it, and hands it back
  let job = null;
  function useStamp(cost) {
    const d = carried, st = machines.stamp; spend(cost); stamps++;
    job = { d, t: 0, dur: 0.75, kind: "stamp", from: d.mesh.position.clone() }; ch.busy = 0.75;
    later(0.32, () => {
      const slot = WS.stampSlot(d, st.num); d.faces[slot] = st.num; dress(d);
      d.slot = slot; d.num = st.num; d.mesh.quaternion.copy(orientSlot(slot));
      stampSnd(); shake = Math.min(1, shake + 0.2); burst(st.plate.clone().add(new T.Vector3(0, 1.4, 0)), new T.Color(0xc07cff), 8);
      floatText(st.plate.clone().setY(7), `<b>${WS.count(d, st.num)} of 6</b>faces are ${st.num}`, "note");
    });
  }
  function useKiln(cost) {
    const d = carried, k = machines.kiln, to = WS.nextMat(d); spend(cost); fired[to] = (fired[to] || 0) + 1;
    job = { d, t: 0, dur: 1.3, kind: "kiln", from: d.mesh.position.clone() }; ch.busy = 1.3; fireSnd();
    later(0.9, () => {
      d.mat = to; dress(d); burst(k.mouth.clone().add(new T.Vector3(0, 1, 1.5)), new T.Color(LOOK[to].glow), 16);
      floatText(k.mouth.clone().setY(9), `<b>${WS.MAT[to].name}</b>x${WS.MAT[to].mult} in every hand`, "note"); chime(5, true);
    });
  }
  function useMelter(v) {
    const d = carried; job = { d, t: 0, dur: 0.6, kind: "melter", from: d.mesh.position.clone() }; ch.busy = 0.6; meltSnd();
    later(0.55, () => { points += v; floatText(machines.melter.mouth.clone().setY(6), `<b>+${fmt(v)}</b>Melted`, "note"); });
  }
  function updateJob(dt) {
    if (!job) return;
    job.t += dt; const u = Math.min(1, job.t / job.dur), d = job.d;
    if (job.kind === "stamp") {
      const st = machines.stamp, p = st.plate.clone().add(new T.Vector3(0, (CELL * 0.5) / 2, 0));
      const inn = Math.min(1, u / 0.3), out = Math.max(0, (u - 0.7) / 0.3);
      d.mesh.position.lerpVectors(job.from, p, inn); if (out > 0) d.mesh.position.lerpVectors(p, handPos(), out);
      d.mesh.scale.setScalar(0.5);
      st.plunger.position.y = 7.6 - (u > 0.3 && u < 0.6 ? Math.sin(((u - 0.3) / 0.3) * Math.PI) * 3.4 : 0);
    } else if (job.kind === "kiln") {
      const k = machines.kiln, inn = Math.min(1, u / 0.25), out = Math.max(0, (u - 0.75) / 0.25);
      d.mesh.position.lerpVectors(job.from, k.mouth, inn); if (out > 0) d.mesh.position.lerpVectors(k.mouth, handPos(), out);
      d.mesh.visible = u < 0.25 || u > 0.75; k.light.intensity = Math.sin(u * Math.PI) * 60; k.mouthMesh.material.color.setHex(u > 0.2 && u < 0.8 ? 0xfff2a0 : 0xff7a2a);
    } else {
      const m = machines.melter, inn = Math.min(1, u / 0.5);
      d.mesh.position.lerpVectors(job.from, m.mouth, inn); d.mesh.position.y += Math.sin(inn * Math.PI) * 3;
      d.mesh.scale.setScalar(0.5 * (1 - Math.max(0, (u - 0.5) / 0.5)));
    }
    if (u >= 1) {
      d.mesh.visible = true; if (job.kind === "melter") { removeDie(d); carried = null; } else clack(0.6);
      job = null;
    }
  }
  const handPos = () => ch.p.clone().add(new T.Vector3(0, 6.6, 0));

  // ---- the press -----------------------------------------------------------------------------------
  function updatePress(dt) {
    const pr = machines.press; pr.t += dt;
    if (pr.t >= WS.PRESS_EVERY) {
      const free = pr.held.findIndex((x) => !x || x.where !== "loose");
      pr.held = pr.held.map((x) => (x && x.where === "loose" && !x.drop ? x : null));
      const slot = pr.held.indexOf(null);
      if (slot >= 0) {
        pr.t = 0; const d = makeDie("plain"); pr.held[slot] = d; d.mesh.scale.setScalar(LOOSE);
        const to = pr.slots[slot].clone(); putLoose(d, to); d.pos.y = 0.6 + LOOSE_H;
        flyTo(d, d.pos, { from: new T.Vector3(-24, 7.5, 2), dur: 0.5, h: 3 }); pressSnd();
      } else pr.t = WS.PRESS_EVERY;
      void free;
    }
  }

  // ---- the plaza drop ------------------------------------------------------------------------------
  let bannerT = 9;
  function banner(text, sub) { ui.banner.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ""}`; bannerT = 0; }
  function updateDrop(dt) {
    const m = machines.drop; m.t += dt;
    if (!m.warned && m.t >= WS.DROP.every - WS.DROP.warn) { m.warned = true; rumble(); }
    if (m.t >= WS.DROP.every) {
      m.t = 0; m.warned = false; shake = Math.min(1, shake + 0.15);
      // the plaza keeps at most a dozen loose dice; the oldest go
      const onPlaza = allDice.filter((d) => d.where === "loose" && d.drop);
      onPlaza.slice(0, Math.max(0, onPlaza.length + WS.DROP.count - 12)).forEach(removeDie);
      for (let i = 0; i < WS.DROP.count; i++) {
        const kind = window.__forceDrop && i === 0 ? window.__forceDrop : WS.rollDrop(); window.__forceDrop = null;
        const d = makeDie(kind); d.drop = true;
        const ang = (Math.random() - 0.5) * 2.2, r = 10 + Math.random() * 16;
        const to = new T.Vector3(PLAZA.x + Math.sin(ang) * r, 0, PLAZA.z + 4 + Math.cos(ang) * r);
        putLoose(d, to);
        later(i * 0.18, () => { flyTo(d, d.pos, { from: m.mouth, dur: 0.9, h: 9 }); });
        d.mesh.position.copy(m.mouth); d.mesh.visible = false; later(i * 0.18, () => (d.mesh.visible = true));
        const info = WS.DROPS.find((x) => x.id === kind);
        if (info && info.rare) { d.rare = info; later(0.9, () => { banner(`${info.name} in the plaza!`, `1 in ${info.oneIn}`); rare(); }); }
      }
      later(0.2, () => clack(1));
      bots.forEach((b) => { if (b.state === "home") { b.state = "wait"; b.wait = 1.6 + Math.random() * 1.6; } });
    }
    dropFill.style.width = (m.t / WS.DROP.every) * 100 + "%";
  }
  function updateBots(dt) {
    for (const b of bots) {
      let moving = false;
      if (b.state === "wait") { b.wait -= dt; if (b.wait <= 0) b.state = "seek"; }
      if (b.state === "seek") {
        if (!b.target || b.target.where !== "loose") {
          const free = allDice.filter((d) => d.where === "loose" && d.drop && !d.fly && !bots.some((o) => o !== b && o.target === d));
          free.sort((x, y) => (y.rare ? 1 : 0) - (x.rare ? 1 : 0) || x.pos.distanceTo(b.p) - y.pos.distanceTo(b.p));
          b.target = free.length && Math.random() < 0.85 ? free[0] : free[rand(Math.max(1, free.length))] || null;
          if (!b.target) { b.state = "back"; }
        }
        if (b.target) {
          const to = b.target.pos; moving = walk(b, to, 13.5, dt);
          if (b.p.distanceTo(new T.Vector3(to.x, 0, to.z)) < 1.8) { b.carrying = b.target; b.target.where = "bot"; b.target.drop = false; b.target = null; b.state = "back"; if (b.carrying.rare) banner(`${b.name} grabbed the ${b.carrying.rare.name}`, ""); }
        }
      }
      if (b.state === "back") {
        const to = b.home.clone().add(new T.Vector3(0, 0, 14)); moving = walk(b, to, 13.5 * slowFor(b.carrying), dt);
        if (b.p.distanceTo(to) < 1.5) {
          if (b.carrying) { removeDie(b.carrying); b.carrying = null; }
          const left = allDice.some((d) => d.where === "loose" && d.drop);
          b.state = left && Math.random() < 0.5 ? "wait" : "home"; b.wait = 1 + Math.random() * 3;
        }
      }
      if (b.carrying) { b.carrying.mesh.position.copy(b.p).add(new T.Vector3(0, 6.6 + Math.sin(performance.now() / 200) * 0.1, 0)); b.carrying.mesh.scale.setScalar(0.5); }
      pose(b.av, moving, !!b.carrying, dt); b.av.g.position.copy(b.p); b.av.g.rotation.y = b.yaw;
    }
  }
  function walk(b, to, speed, dt) {
    const dx = to.x - b.p.x, dz = to.z - b.p.z, l = Math.hypot(dx, dz); if (l < 0.3) return false;
    const s = Math.min(l, speed * dt); b.p.x += (dx / l) * s; b.p.z += (dz / l) * s; b.yaw = Math.atan2(dx, dz); return true;
  }

  // ---- the board rolls itself ----------------------------------------------------------------------
  let clock = 0;
  const batches = [];
  function rollBoard() {
    const dice = grid.filter((d) => d && !d.anim);
    if (!dice.length) return;
    const b = { dice: new Set(dice), left: dice.length };
    dice.forEach((d) => {
      d.slot = rand(6); d.num = d.faces[d.slot];
      d.anim = { t: -(((d.cell % N) + Math.floor(d.cell / N)) * 0.05), dur: 0.72, hop: 4.5, from: d.mesh.quaternion.clone(), to: orientSlot(d.slot),
        axis: new T.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize(), turns: (1.5 + Math.random() * 1.5) * Math.PI * 2, batch: b };
    });
    batches.push(b);
  }
  function updateClock(dt) {
    clock += dt; if (clock >= WS.ROLL_EVERY) { clock = 0; rollBoard(); }
    rollFill.style.width = (clock / WS.ROLL_EVERY) * 100 + "%";
  }
  const qa = new T.Quaternion(), qb = new T.Quaternion();
  function updateDice(dt) {
    for (const d of allDice) {
      let base = null, y = CELL / 2;
      if (d.where === "board") base = cellPos(d.cell);
      if (d.where === "carried" && (!job || job.d !== d)) {
        d.mesh.position.copy(handPos()); d.mesh.position.y += Math.sin(performance.now() / 200) * 0.1; d.mesh.scale.setScalar(0.5); d.anim = null; continue;
      }
      if (d.where === "loose") {
        if (d.fly) {
          const f = d.fly; f.t += dt; const u = Math.min(1, f.t / f.dur), e = 1 - Math.pow(1 - u, 3);
          d.mesh.position.lerpVectors(f.from, f.to, u); d.mesh.position.y += f.h * 4 * u * (1 - u) * (f.from.y > f.to.y ? 0.6 : 1);
          qa.setFromAxisAngle(f.axis, (1 - e) * f.turns * Math.PI); qb.copy(f.q1).multiply(qa); d.mesh.quaternion.slerpQuaternions(f.q0, qb, Math.min(1, u / 0.15));
          d.mesh.scale.setScalar(LOOSE);
          if (u >= 1) { d.mesh.quaternion.copy(f.q1); d.mesh.position.copy(f.to); d.fly = null; clack(0.5); dust(d.pos.clone().setY(0.15), 0.6); }
        } else {
          d.mesh.position.copy(d.pos); d.mesh.scale.setScalar(LOOSE);
          if (d.rare) d.mesh.position.y += 0.4 + Math.sin(performance.now() / 300) * 0.3;
        }
        glowRare(d, dt); continue;
      }
      if (!base) { glowRare(d, dt); continue; }
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
      d.mesh.position.set(base.x, y - ((1 - s) * CELL) / 2 + d.lift, base.z);
      d.glow = Math.max(0, d.glow - dt * 0.9);
      for (const m of d.mesh.material) m.emissive.copy(d.glowColor).multiplyScalar(d.glow * 0.55).add(d.baseEmissive);
    }
  }
  function glowRare(d, dt) {
    const pulse = d.rare && d.where !== "gone" ? 0.35 + 0.25 * Math.sin(performance.now() / 180) : 0;
    for (const m of d.mesh.material) { m.emissive.copy(d.baseEmissive); if (pulse) m.emissive.add(new T.Color(d.rare.id === "lava" ? 0xff7a2a : 0xff9cf0).multiplyScalar(pulse)); }
    void dt;
  }
  function landed(d, b) {
    clack(b.dice.size > 6 ? 0.7 : 1); dust(d.mesh.position.clone().setY(0.2), 1);
    b.left--; if (b.left <= 0) { batches.splice(batches.indexOf(b), 1); resolve(); }
  }
  // a die lifted mid-roll leaves its batch
  function settleBatches() {
    for (const b of batches.slice()) for (const d of b.dice) if (d.where !== "board" && d.anim) { d.anim = null; b.dice.delete(d); b.left--; if (b.left <= 0) { batches.splice(batches.indexOf(b), 1); resolve(); } }
  }

  // ---- paying out ----------------------------------------------------------------------------------
  const timers = [];
  const later = (s, fn) => timers.push({ t: s, fn });
  const boardView = () => grid.map((d) => (d && d.where === "board" ? { num: d.num, mat: d.mat } : null));
  let lastRoll = { total: 0, hands: [] };
  function resolve() {
    const list = WS.findHands(boardView());
    if (!list.length) { thud(); lastRoll = { total: 0, hands: [] }; return; }
    list.sort((a, c) => a.pay - c.pay);
    let total = 0; list.forEach((h) => (total += h.pay));
    lastRoll = { total, hands: list.map((h) => h.name) };
    list.forEach((h, k) => {
      later(k * 0.32, () => {
        const big = h.size >= 4 || h.pay >= 150;
        const col = new T.Color(h.set ? LOOK[h.set].glow : h.kind === "straight" ? 0x7fe8ff : 0xffd040);
        h.cells.forEach((i) => { const d = grid[i]; if (d) { d.glow = 1.6; d.glowColor.copy(col); } });
        chime(k + (h.size - 2), big);
        const c = centroid(h.cells);
        floatText(c, `<b>+${fmt(h.pay)}</b>${h.name}${h.set ? ` · ${WS.MAT[h.set].name} set x${WS.SET_X}` : ""}`, h.set ? "set" : h.kind);
        points += h.pay;
        if (big) { burst(c, col, 14 + h.size * 3); shake = Math.min(1, shake + 0.3 + h.size * 0.03); }
      });
    });
    const end = (list.length - 1) * 0.32 + 0.35;
    if (list.length > 1 || total >= 150) later(end, () => { ui.total.textContent = `+${fmt(total)}`; totalT = 0; fanfare(list.length); });
  }
  function centroid(cells) { const v = new T.Vector3(); cells.forEach((i) => v.add(cellPos(i))); return v.divideScalar(cells.length).setY(CELL + 2.5); }
  const floats = [];
  function floatText(pos, inner, cls) {
    const el = document.createElement("div"); el.className = "float " + (cls || ""); el.innerHTML = inner; document.body.appendChild(el);
    floats.push({ el, pos: pos.clone(), t: 0, life: 1.6 });
  }
  let totalT = 9, bumpT = 0;
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
  const v3 = new T.Vector3();
  function project(p, el) {
    v3.copy(p).project(camera); el.style.left = ((v3.x + 1) / 2) * innerWidth + "px"; el.style.top = ((1 - v3.y) / 2) * innerHeight + "px";
    el.style.display = v3.z > 1 ? "none" : ""; return v3.z;
  }
  function updateFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt; const u = p.t / p.life;
      if (p.ring) { const s = 1 + u * 3 * p.ring; p.m.scale.set(s, s, s); p.m.material.opacity = 0.5 * (1 - u); }
      else { p.v.y -= 60 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 8; p.m.rotation.y += dt * 6; const s = Math.max(0.01, 1 - u); p.m.scale.set(s, s, s); }
      if (u >= 1) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); }
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.t += dt; const u = f.t / f.life;
      const z = project(f.pos.clone().setY(f.pos.y + u * 4), f.el);
      const pop = u < 0.12 ? 0.6 + (u / 0.12) * 0.55 : u < 0.2 ? 1.15 - ((u - 0.12) / 0.08) * 0.15 : 1;
      f.el.style.transform = `translate(-50%,-50%) scale(${pop})`; f.el.style.opacity = u > 0.75 ? (1 - u) / 0.25 : 1;
      if (u >= 1 || z > 1) { f.el.remove(); floats.splice(i, 1); }
    }
    totalT += dt;
    if (totalT < 1.6) {
      const u = totalT / 1.6, s = u < 0.15 ? 0.6 + (u / 0.15) * 0.6 : u < 0.25 ? 1.2 - (u - 0.15) * 2 : 1;
      ui.total.style.opacity = u > 0.75 ? (1 - u) / 0.25 : 1; ui.total.style.transform = `translate(-50%,-50%) scale(${s})`;
    } else ui.total.style.opacity = 0;
    bannerT += dt;
    if (bannerT < 4) { const u = bannerT / 4; ui.banner.style.opacity = u > 0.8 ? (1 - u) / 0.2 : 1; ui.banner.style.transform = `translateX(-50%) scale(${u < 0.06 ? 0.8 + u / 0.06 * 0.25 : 1})`; }
    else ui.banner.style.opacity = 0;
    if (shown !== points) {
      const before = Math.floor(shown);
      shown = shown < points ? Math.min(points, shown + Math.max(1, (points - shown) * dt * 8)) : points;
      ui.points.textContent = fmt(shown); if (Math.floor(shown) !== before) { ui.points.classList.add("bump"); bumpT = 0.08; }
    }
    if (bumpT > 0) { bumpT -= dt; if (bumpT <= 0) ui.points.classList.remove("bump"); }
    for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } }
    bots.forEach((b) => project(b.p.clone().setY(8.2), b.tag));
  }

  // ---- the screen: what E does, and the faces of the die you hold ----------------------------------
  const faceChip = (n, m, kind) => {
    const l = LOOK[m]; const bg = kind === "wild" ? "linear-gradient(135deg,#ff6a8a,#ffe066,#6aa8ff,#c07cff)" : l.body;
    return `<span style="background:${bg};color:${kind === "wild" ? "#fff" : l.ink}">${kind === "wild" ? "★" : n}</span>`;
  };
  let lastPromptKey = "", lastFacesKey = "";
  let current = null;
  function updateScreen() {
    current = plan();
    const key = current ? `${current.label}|${current.cost}|${current.can}` : "";
    if (key !== lastPromptKey) {
      lastPromptKey = key;
      ui.prompt.className = "hud" + (current && !current.can ? " no" : "");
      ui.prompt.innerHTML = current ? `<span class="k">E</span>${current.label}${current.cost ? ` · ${fmt(current.cost)}` : ""}` : "";
      ui.act.innerHTML = current ? `${current.label.split(" ").slice(0, 3).join(" ")}${current.cost ? `<br>${fmt(current.cost)}` : ""}` : "";
      ui.act.style.opacity = current ? 1 : 0.4;
    }
    const d = carried || (ch.busy > 0 && job ? job.d : null);
    const fk = d && d.where !== "gone" ? d.faces.join() + d.mat + d.kind : "";
    if (fk !== lastFacesKey) {
      lastFacesKey = fk;
      ui.faces.innerHTML = d ? d.faces.map((n) => faceChip(n, d.mat, d.kind)).join("") + `<em>${d.kind === "wild" ? "Wild" : d.kind === "weighted" ? "Weighted" : WS.MAT[d.mat].name} x${WS.MAT[d.mat].mult}</em>` : "";
    }
  }

  // ---- frame ---------------------------------------------------------------------------------------
  function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
  addEventListener("resize", resize); resize();
  const camTarget = new T.Vector3(0, 4.5, 17);
  let last = performance.now();
  function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); requestAnimationFrame(frame); }
  function step(dt) {
    moveChar(dt);
    if (actPressed) { const p = current || plan(); if (p && p.can && p.run) p.run(); else if (p && !p.can) buzz(); }
    actPressed = false;
    if (ch.busy > 0) ch.busy -= dt;
    updateJob(dt); updatePress(dt); updateDrop(dt); updateBots(dt); updateClock(dt); settleBatches();
    updateDice(dt); updateFx(dt); updateScreen();
    camTarget.lerp(ch.p.clone().add(new T.Vector3(0, 4.5, 0)), Math.min(1, dt * 12));
    const cp = Math.cos(cam.pitch);
    camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * cp * cam.dist);
    camera.lookAt(camTarget);
    sun.position.set(camTarget.x + 35, 70, camTarget.z + 25); sun.target.position.copy(camTarget);
    if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake * 0.9; camera.position.y += (Math.random() - 0.5) * shake * 0.9; shake = Math.max(0, shake - dt * 2.5); }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  // a hook for shots and checks
  window.__game = {
    step,
    at(x, z, yaw) { ch.p.set(x, 0, z); if (yaw !== undefined) ch.yaw = yaw; camTarget.copy(ch.p).add(new T.Vector3(0, 4.5, 0)); },
    cam(yaw, pitch, dist) { cam.yaw = yaw; cam.pitch = pitch; cam.dist = dist; },
    press() { actPressed = true; },
    get prompt() { return current && { label: current.label, cost: current.cost, can: current.can }; },
    get points() { return points; }, set points(v) { points = v; shown = v; },
    get carried() { return carried && { faces: carried.faces.slice(), mat: carried.mat, kind: carried.kind }; },
    get board() { return grid.map((d) => d && { faces: d.faces.slice(), mat: d.mat, num: d.num }); },
    get loose() { return allDice.filter((d) => d.where === "loose").map((d) => ({ x: d.pos.x, z: d.pos.z, kind: d.kind, mat: d.mat, drop: !!d.drop })); },
    get lastRoll() { return lastRoll; },
    get stampNum() { return machines.stamp.num; },
    dropSoon(kind) { window.__forceDrop = kind; machines.drop.t = WS.DROP.every - 0.01; },
    roll: rollBoard,
  };
})();
