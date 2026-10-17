// Headless pacing simulation for the Combo Dice tycoon mockup.
//
//   node scripts/prestige-sim.js            # pacing table at normal speed, greedy buyer
//   node scripts/prestige-sim.js --cycles 3 # simulate N prestige cycles
//
// It ports the real board scoring rule (color groups, number chains, loose dice) and the
// economy constants from tycoon-board-3d.html, drives a greedy buyer, and reports the
// game-time it takes to hit each pacing milestone. Keep ECON / the stats() / threshold math
// in sync with the "economy" and "prestige" sections of tycoon-board-3d.html.

// ---- economy constants (mirror of tycoon-board-3d.html) -------------------------------------
const E = (k, d) => (process.env[k] !== undefined ? +process.env[k] : d);
const ECON = {
  dieBase: E("DIE_BASE", 160), dieRate: E("DIE_RATE", 1.29),     // Buy die
  comboBase: E("COMBO_BASE", 560), comboRate: E("COMBO_RATE", 1.43), // Better combos
  speedBase: E("SPEED_BASE", 480), speedRate: E("SPEED_RATE", 1.5), // Faster rolls
  comboStep: 0.25,
  speedDecay: 0.9,
  rollMsBase: 2000,
  startDice: 4,
  prestige: { base: E("P_BASE", 900000), rate: E("P_RATE", 2.8), pointsPer: 0.25, comboCapPer: 1, rollFloorPer: 60, startDiePer: 1 },
};
const COLORS = 5;

const rollFloor = p => Math.max(220, 500 - ECON.prestige.rollFloorPer * p);
const comboCap = p => 5 + ECON.prestige.comboCapPer * p;
const boardSizeFor = p => (p >= 2 ? 7 : p >= 1 ? 6 : 5);

function stats(S) {
  return {
    rollMs: Math.max(rollFloor(S.prestige), Math.round(ECON.rollMsBase * Math.pow(ECON.speedDecay, S.speedLv))),
    combo: Math.min(comboCap(S.prestige), 1 + ECON.comboStep * S.comboLv),
    pointsMult: Math.pow(1 + ECON.prestige.pointsPer, S.prestige),
  };
}
const cost = {
  die: S => Math.round(ECON.dieBase * Math.pow(ECON.dieRate, S.bought)),
  combo: S => Math.round(ECON.comboBase * Math.pow(ECON.comboRate, S.comboLv)),
  speed: S => Math.round(ECON.speedBase * Math.pow(ECON.speedRate, S.speedLv)),
};
const canBuy = (S, k, N) =>
  (k !== "die" || diceCount(S) < N * N) &&
  (k !== "speed" || stats(S).rollMs > rollFloor(S.prestige)) &&
  (k !== "combo" || stats(S).combo < comboCap(S.prestige));
const diceCount = S => ECON.startDice + ECON.prestige.startDiePer * S.prestige + S.bought;

// threshold on run points to gain level `lv+1` from level `lv` (incremental, so levels bank)
const levelThreshold = lv => ECON.prestige.base * Math.pow(ECON.prestige.rate, lv);
// total run points to reach `target` levels from `from`
function runPointsFor(from, target) {
  let t = 0;
  for (let lv = from; lv < target; lv++) t += levelThreshold(lv);
  return t;
}
function levelsReachable(runPoints, from) {
  let lv = from, t = 0;
  while (true) { const need = levelThreshold(lv); if (runPoints < t + need) break; t += need; lv++; }
  return lv - from;
}

// ---- scoring port ---------------------------------------------------------------------------
const rnd = n => Math.floor(Math.random() * n);
function cellOrder(N) {
  const c0 = (N - 1) / 2;
  return [...Array(N * N).keys()].sort((a, b) => dist(a) - dist(b));
  function dist(i) { const r = Math.floor(i / N) - c0, c = i % N - c0; return r * r + c * c + (r + c) * 0.01; }
}
function neighbors(i, N) {
  const r = Math.floor(i / N), c = i % N, out = [];
  for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const r2 = r + dr, c2 = c + dc;
    if (r2 >= 0 && r2 < N && c2 >= 0 && c2 < N) out.push(r2 * N + c2);
  }
  return out;
}
function scoreOnce(cells, combo, pointsMult, N) {
  const live = i => cells[i];
  const mult = n => 1 + (n - 1) * combo;
  const flood = same => {
    const seen = new Set(), out = [];
    for (let i = 0; i < N * N; i++) {
      if (!live(i) || seen.has(i)) continue;
      const g = [i]; seen.add(i);
      for (let k = 0; k < g.length; k++) for (const j of neighbors(g[k], N))
        if (!seen.has(j) && live(j) && same(live(g[k]), live(j))) { seen.add(j); g.push(j); }
      out.push(g);
    }
    return out;
  };
  const sumOf = g => g.reduce((t, i) => t + live(i).face, 0);
  const colorGroups = flood((x, y) => x.color === y.color);
  let total = 0;
  const loose = colorGroups.filter(g => g.length === 1).flat();
  if (loose.length) total += Math.round(sumOf(loose) * pointsMult);
  for (const g of colorGroups.filter(g => g.length > 1)) total += Math.round(sumOf(g) * mult(g.length) * pointsMult);
  for (const g of flood((x, y) => x.face === y.face).filter(g => g.length > 1)) total += Math.round(sumOf(g) * mult(g.length) * pointsMult);
  return total;
}
// average points per roll for a given dice count / combo / mult / board size
const avgCache = new Map();
function avgScore(S, N) {
  const d = diceCount(S), s = stats(S);
  const key = `${d}|${s.combo.toFixed(3)}|${s.pointsMult.toFixed(3)}|${N}`;
  if (avgCache.has(key)) return avgCache.get(key);
  const order = cellOrder(N), occupied = order.slice(0, d);
  const trials = 400; let sum = 0;
  for (let t = 0; t < trials; t++) {
    const cells = Array(N * N).fill(null);
    for (const i of occupied) cells[i] = { color: rnd(COLORS), face: 1 + rnd(6) };
    sum += scoreOnce(cells, s.combo, s.pointsMult, N);
  }
  const v = sum / trials; avgCache.set(key, v); return v;
}

// ---- greedy buyer ---------------------------------------------------------------------------
function fresh() { return { points: 0, run: 0, bought: 0, speedLv: 0, comboLv: 0, prestige: 0 }; }
function greedyBuy(S, N) {
  for (;;) {
    const opts = ["die", "combo", "speed"].filter(k => canBuy(S, k, N)).map(k => [k, cost[k](S)])
      .filter(([, c]) => c <= S.points).sort((a, b) => a[1] - b[1]);
    if (!opts.length) return;
    const [k, c] = opts[0];
    S.points -= c;
    if (k === "die") S.bought++; else if (k === "combo") S.comboLv++; else S.speedLv++;
  }
}

const fmtT = s => `${Math.floor(s / 60)}m${String(Math.floor(s % 60)).padStart(2, "0")}s`;
const fmt = n => n < 1e4 ? Math.round(n).toLocaleString("en-US") : n < 1e6 ? (n / 1e3).toFixed(1) + "K" : (n / 1e6).toFixed(2) + "M";

function run(cycles) {
  const S = fresh();
  let gt = 0; // game-seconds
  let N = boardSizeFor(S.prestige);
  const marks = {};
  const mark = (k, extra) => { if (marks[k] === undefined) { marks[k] = gt; if (extra) marks[k + "_x"] = extra; } };
  const rows = [];
  let cycle = 0, cycleStart = 0, prevPeakRun = 0;

  for (let step = 0; step < 6_000_000 && cycle < cycles; step++) {
    const s = stats(S);
    gt += s.rollMs / 1000;
    const gained = avgScore(S, N);
    S.points += gained; S.run += gained;
    greedyBuy(S, N);

    const d = diceCount(S);
    if (d >= ECON.startDice + 1) mark("firstDie");
    if (d >= 9) mark("dice9");
    if (d >= 25) mark("full5x5");
    if (!canBuy(S, "combo", N)) mark("comboCap");
    if (!canBuy(S, "speed", N)) mark("speedCap");
    const avail = levelsReachable(S.run, S.prestige);
    if (avail >= 1) mark("firstPrestige");

    // Greedy player prestiges as soon as a level is reachable — claiming it promptly keeps each
    // prestige a +1 step (so the 5→6→7 board growth is felt one milestone at a time).
    if (avail >= 1) {
      rows.push({
        cycle: cycle + 1, dur: gt - cycleStart, atGt: gt, gained: avail, from: S.prestige,
        to: S.prestige + avail, peakRun: S.run, peakDice: d, N,
        timeToPrevPeak: marks["prevPeak_t"] ?? null,
      });
      // apply prestige
      S.prestige += avail; S.run = 0; S.points = 0; S.bought = 0; S.speedLv = 0; S.comboLv = 0;
      N = boardSizeFor(S.prestige);
      cycle++; cycleStart = gt; prevPeakRun = rows[rows.length - 1].peakRun;
      // reset per-cycle marks that should re-measure "time to reach previous peak"
      delete marks.prevPeak_t;
      marks._prevPeakTarget = prevPeakRun;
    }
    // time for the NEW run to reach the previous run's peak run-points
    if (marks._prevPeakTarget && S.run >= marks._prevPeakTarget && marks.prevPeak_t === undefined)
      marks.prevPeak_t = gt - cycleStart;

    if (gt > 60 * 60 * 4) break; // 4h game-time safety
  }

  console.log("\nPacing milestones (normal speed, greedy buyer):");
  const label = {
    firstDie: "first die bought", dice9: "9 dice", full5x5: "full 5x5 (25 dice)",
    comboCap: "combo cap reached", speedCap: "speed cap reached", firstPrestige: "first prestige reachable",
  };
  for (const k of ["firstDie", "dice9", "full5x5", "comboCap", "speedCap", "firstPrestige"])
    console.log(`  ${label[k].padEnd(26)} ${marks[k] !== undefined ? fmtT(marks[k]) : "—"}`);

  console.log("\nPrestige cycles:");
  console.log("  #  board  dur       gained  lvl→lvl   peak run pts  dice  time-to-prev-peak");
  for (const r of rows)
    console.log(`  ${String(r.cycle).padEnd(2)} ${r.N}x${r.N}   ${fmtT(r.dur).padEnd(9)} +${String(r.gained).padEnd(5)} ${r.from}→${String(r.to).padEnd(6)} ${fmt(r.peakRun).padEnd(13)} ${String(r.peakDice).padEnd(5)} ${r.timeToPrevPeak != null ? fmtT(r.timeToPrevPeak) : "—"}`);
  console.log("");
}

const argCycles = (() => { const i = process.argv.indexOf("--cycles"); return i > 0 ? +process.argv[i + 1] : 4; })();
run(argCycles);
