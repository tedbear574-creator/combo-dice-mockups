// Combo Dice workshop prototype: the rules (dice, what a roll pays, machine prices, plaza drops).
// Pure; the 3D page (workshop.js) and the economy sim (node verb/workshop-sim.js) both use it.
(function (root) {
  "use strict";
  const N = 5;
  // materials, in kiln order: a die's number counts x mult in every hand; fire = the kiln's price to reach it
  const MATS = ["stone", "iron", "gold", "glass", "lava"];
  const MAT = {
    stone: { name: "Stone", mult: 1, fire: 0 },
    iron: { name: "Iron", mult: 2, fire: 100 },
    gold: { name: "Gold", mult: 3, fire: 1500 },
    glass: { name: "Glass", mult: 5, fire: 20000 },
    lava: { name: "Lava", mult: 8, fire: 250000 },
  };
  const KIND_MULT = [0, 0, 1, 3, 6, 12, 20, 30, 42, 56, 72, 90, 110, 130, 150, 170, 190, 210, 235, 260, 285, 310, 340, 370, 400, 430];
  const STRAIGHT_MULT = [0, 0, 0, 2, 5, 10];
  const SET_X = 2; // a hand all of one material above stone
  // the stamp: each stamp you buy raises the next one's price (grow), and a face costs more the more faces of
  // that die already show n (face)
  const STAMP = { base: 5, grow: 1.1, face: 1.3 };
  // the kiln: each die fired to a material raises the next firing to it
  const FIRE_GROW = 1.5;
  const PRESS_EVERY = 5, TRAY = 4, ROLL_EVERY = 6;
  const DROP = { every: 30, count: 4, warn: 4 };
  // plaza drops, rarest first; anything else is a plain stone die
  const DROPS = [
    { id: "lava", name: "Lava die", oneIn: 60, rare: true },
    { id: "wild", name: "Wild die", oneIn: 25, rare: true },
    { id: "gold", name: "Gold die", oneIn: 10 },
    { id: "weighted", name: "Weighted die", oneIn: 6 },
  ];
  const WILD = 0; // a face that matches any number

  const NAMES = ["", "", "Pair", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

  function newDie(kind) {
    if (kind === "weighted") return { faces: [4, 5, 6, 4, 5, 6], mat: "stone", kind, spent: 0 };
    if (kind === "wild") return { faces: [WILD, WILD, WILD, WILD, WILD, WILD], mat: "stone", kind, spent: 0 };
    if (kind === "gold") return { faces: [3, 4, 1, 6, 2, 5], mat: "gold", kind: null, spent: 0 };
    if (kind === "lava") return { faces: [3, 4, 1, 6, 2, 5], mat: "lava", kind: null, spent: 0 };
    return { faces: [3, 4, 1, 6, 2, 5], mat: "stone", kind: null, spent: 0 };
  }
  const count = (die, n) => die.faces.filter((f) => f === n).length;
  // null when the stamp can't change this die (wild, or every face already n)
  function stampCost(die, n, stamps) {
    if (die.kind === "wild") return null;
    const have = count(die, n);
    if (have >= 6) return null;
    return Math.round(STAMP.base * Math.pow(STAMP.grow, stamps || 0) * Math.pow(STAMP.face, Math.max(0, have - 1)));
  }
  // which face the stamp changes: the face holding the number this die has most of, other than n, so a die
  // keeps its spread for straights only if you stamp a spread
  function stampSlot(die, n, rnd) {
    const slots = die.faces.map((f, i) => i).filter((i) => die.faces[i] !== n);
    if (!slots.length) return -1;
    return slots[Math.floor((rnd || Math.random)() * slots.length)];
  }
  function nextMat(die) {
    const i = MATS.indexOf(die.mat);
    return i < MATS.length - 1 ? MATS[i + 1] : null;
  }
  // fired[mat] = dice already fired to mat
  function fireCost(die, fired) { const m = nextMat(die); return m ? Math.round(MAT[m].fire * Math.pow(FIRE_GROW, (fired && fired[m]) || 0)) : null; }
  function meltValue(die) { return 5 + Math.floor(die.spent / 2); }
  function rollDrop(rnd) {
    for (const d of DROPS) if ((rnd || Math.random)() < 1 / d.oneIn) return d.id;
    return "plain";
  }

  // grid: N*N cells, each null or { num, mat } (num WILD = matches anything). Returns the hands that pay,
  // no die in two hands, biggest first taken.
  function findHands(grid) {
    const out = [];
    const isWild = (i) => grid[i] && grid[i].num === WILD;
    const nb = (j) => { const r = Math.floor(j / N), c = j % N; return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
      .filter(([a, b]) => a >= 0 && a < N && b >= 0 && b < N).map(([a, b]) => a * N + b); };
    // of a kind: dice touching edge to edge with one number (wilds join any)
    for (let v = 1; v <= 6; v++) {
      const seen = new Set();
      for (let i = 0; i < N * N; i++) {
        const d = grid[i]; if (!d || d.num !== v || seen.has(i)) continue;
        const group = [i]; seen.add(i);
        for (let k = 0; k < group.length; k++) for (const n of nb(group[k])) {
          if (!seen.has(n) && grid[n] && (grid[n].num === v || isWild(n))) { seen.add(n); group.push(n); }
        }
        if (group.length >= 2) out.push({ kind: "kind", cells: group, size: group.length, vals: group.map(() => v),
          name: group.length === 2 ? `Pair of ${v}s` : `${NAMES[group.length] || group.length} ${v}s` });
      }
    }
    // straights: 3 to 5 in a row or column counting up or down by one (wilds fill gaps)
    for (let line = 0; line < 2 * N; line++) {
      const cells = []; for (let k = 0; k < N; k++) cells.push(line < N ? line * N + k : k * N + (line - N));
      for (let k = 0; k <= N - 3; k++) for (const dir of [1, -1]) for (let s = 1; s <= 6; s++) {
        let j = k; const vals = [];
        while (j < N) {
          const want = s + dir * (j - k), d = grid[cells[j]];
          if (want < 1 || want > 6 || !d || (d.num !== want && d.num !== WILD)) break;
          vals.push(want); j++;
        }
        const run = cells.slice(k, j);
        if (run.length >= 3 && run.some((i) => !isWild(i)))
          out.push({ kind: "straight", cells: run, size: run.length, vals,
            name: `Straight ${Math.min(...vals)}-${Math.max(...vals)}` });
      }
    }
    for (const h of out) {
      const sum = h.cells.reduce((a, i, k) => a + h.vals[k] * MAT[grid[i].mat].mult, 0);
      h.pay = sum * (h.kind === "kind" ? KIND_MULT[Math.min(h.size, KIND_MULT.length - 1)] : STRAIGHT_MULT[h.size]);
      const m = grid[h.cells[0]].mat;
      if (m !== "stone" && h.cells.every((i) => grid[i].mat === m)) { h.pay *= SET_X; h.set = m; }
    }
    out.sort((a, b) => b.pay - a.pay || b.size - a.size);
    const used = new Set(), kept = [];
    for (const h of out) if (h.cells.every((i) => !used.has(i))) { h.cells.forEach((i) => used.add(i)); kept.push(h); }
    return kept;
  }

  const api = { N, MATS, MAT, KIND_MULT, STRAIGHT_MULT, SET_X, STAMP, FIRE_GROW, PRESS_EVERY, TRAY, ROLL_EVERY, DROP, DROPS, WILD,
    newDie, count, stampCost, stampSlot, nextMat, fireCost, meltValue, rollDrop, findHands };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.WS = api;
})(typeof window !== "undefined" ? window : globalThis);
