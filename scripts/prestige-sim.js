// Headless pacing simulation for the Combo Dice v2 economy (the "dice worth having" rework).
//
//   node scripts/prestige-sim.js
//
// It mirrors the v2 constants and scoring from tycoon-v2.html — rarity tiers, per-die multipliers, the scarce
// board (cells unlock one at a time), and crate pulls — and drives two players:
//   • free   — never spends Robux (luck ×1)
//   • buyer  — buys a 15-min Luck Boost (×2) whenever one isn't running
// and reports the game-time each hits the pacing milestones:
//   first crate ~3-5 min · first rare-tier die < 15 min · board full < 1 h · top tier a multi-day chase (free).
// Keep TIERS / COST / CRATE_* / scoring in sync with the matching sections of tycoon-v2.html.

// ---- constants (mirror of tycoon-v2.html) ---------------------------------------------------
const TIERS = [
  { id: "common",   mult: 1,   sides: 6,  w: 1000 },
  { id: "uncommon", mult: 1.6, sides: 6,  w: 300 },
  { id: "rare",     mult: 2.6, sides: 8,  w: 95 },
  { id: "epic",     mult: 4.2, sides: 10, w: 26 },
  { id: "legend",   mult: 7,   sides: 12, w: 6 },
  { id: "mythic",   mult: 12,  sides: 20, w: 1 },
];
const COLORS = 5;
const dieMult = (tier, level) => TIERS[tier].mult * (1 + .5 * (level || 0));
function faceSet(sides) { if (sides === 6) return [3, 4, 1, 6, 2, 5]; const o = []; for (let i = 0; i < 6; i++) o.push(Math.round(1 + i * (sides - 1) / 5)); return o; }
const rollFloor = p => Math.max(220, 500 - 60 * p);
const manualFloor = s => Math.max(120, 300 - 18 * s.speedLv); // active-tap interval; faster-rolls lowers it
const comboCap = p => 5 + p;
const boardSizeFor = p => Math.min(7, 5 + (p >= 2 ? 2 : p >= 1 ? 1 : 0));
const COST = {
  cell: s => Math.round(140 * Math.pow(1.4, s.cells - 3)),
  combo: s => Math.round(260 * Math.pow(1.42, s.comboLv)),
  speed: s => Math.round(300 * Math.pow(1.5, s.speedLv)),
};
const CRATE_UNLOCK = 1600, SHINY_BASE = 1 / 750, CRATE_CD = 60; // seconds between crate opens
// A crate cooldown (not just cost) is what keeps crates an EVENT and stops an active earner from spam-filling the
// board in minutes — board-fill is paced by ~CRATE_CD × (dice needed), not by how fast you can earn.
// Crate cost still climbs within a prestige run (a per-run arc) and resets each prestige.
const crateCost = s => Math.round(300 * Math.pow(1.18, s.crateRun));
const levelThreshold = lv => 60000 * Math.pow(2.9, lv);
const rollMsOf = s => Math.max(rollFloor(s.prestige), Math.round(2000 * Math.pow(.9, s.speedLv)));
const comboOf = s => Math.min(comboCap(s.prestige), 1 + .25 * s.comboLv);

const rnd = n => Math.floor(Math.random() * n);
function pickTier(l) { const wsum = TIERS.reduce((t, x, i) => t + x.w * (i ? l : 1), 0); let r = Math.random() * wsum; for (let i = 0; i < TIERS.length; i++) { const w = TIERS[i].w * (i ? l : 1); if ((r -= w) < 0) return i; } return 0; }

// ---- scoring port (color groups, number chains, loose; per-die face multiplier) -------------
function cellOrder(N) { const c0 = (N - 1) / 2; return [...Array(N * N).keys()].sort((a, b) => d(a) - d(b)); function d(i) { const r = Math.floor(i / N) - c0, c = i % N - c0; return r * r + c * c + (r + c) * .01; } }
function neighbors(i, N) { const r = Math.floor(i / N), c = i % N, out = []; for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { const r2 = r + dr, c2 = c + dc; if (r2 >= 0 && r2 < N && c2 >= 0 && c2 < N) out.push(r2 * N + c2); } return out; }
function scoreOnce(cells, combo, N) {
  const live = i => cells[i];
  const mult = n => 1 + (n - 1) * combo;
  const flood = same => { const seen = new Set(), out = []; for (let i = 0; i < N * N; i++) { if (!live(i) || seen.has(i)) continue; const g = [i]; seen.add(i); for (let k = 0; k < g.length; k++) for (const j of neighbors(g[k], N)) if (!seen.has(j) && live(j) && same(live(g[k]), live(j))) { seen.add(j); g.push(j); } out.push(g); } return out; };
  const wsum = g => g.reduce((t, i) => t + cells[i].face * cells[i].mult, 0);
  const colorGroups = flood((x, y) => x.color === y.color);
  let total = 0;
  const loose = colorGroups.filter(g => g.length === 1).flat();
  if (loose.length) total += Math.round(wsum(loose));
  for (const g of colorGroups.filter(g => g.length > 1)) total += Math.round(wsum(g) * mult(g.length));
  for (const g of flood((x, y) => x.face === y.face).filter(g => g.length > 1)) total += Math.round(wsum(g) * mult(g.length));
  return total;
}
// Monte-Carlo average points per roll for the current placed dice. Cached by a board signature.
const avgCache = new Map();
function avgScore(s) {
  const N = boardSizeFor(s.prestige), order = cellOrder(N), placed = s.board; // s.board: list of {tier,color,level}
  const key = N + "|" + comboOf(s).toFixed(3) + "|" + placed.map(d => d.tier + d.color + (d.level | 0)).sort().join(",");
  if (avgCache.has(key)) return avgCache.get(key);
  const combo = comboOf(s), trials = 160; let sum = 0;
  for (let t = 0; t < trials; t++) {
    const cells = Array(N * N).fill(null);
    placed.forEach((d, k) => { const vals = faceSet(TIERS[d.tier].sides); cells[order[k]] = { color: d.color, face: vals[rnd(6)], mult: dieMult(d.tier, d.level) }; });
    sum += scoreOnce(cells, combo, N);
  }
  const v = sum / trials; avgCache.set(key, v); return v;
}

// ---- a player -------------------------------------------------------------------------------
function fresh() { return { points: 0, lifetime: 0, runPoints: 0, cells: 3, comboLv: 0, speedLv: 0, prestige: 0, cratesOpened: 0, crateRun: 0,
  board: [{ tier: 0, color: 0 }, { tier: 0, color: 1 }, { tier: 0, color: 2 }], storage: [], collection: new Set(["0:0", "0:1", "0:2"]) }; }
// Prestige: keep every die + the collection, reset the run (points, upgrades, cells, crate-run cost), grow the board.
function doPrestige(s) {
  s.prestige++; s.points = 0; s.runPoints = 0; s.comboLv = 0; s.speedLv = 0; s.cells = 3; s.crateRun = 0; s.crateReadyAt = 0;
  const all = [...s.board, ...s.storage]; all.sort((a, b) => dieMult(b.tier, b.level) - dieMult(a.tier, a.level));
  s.board = all.slice(0, s.cells); s.storage = all.slice(s.cells);
}
const maxCells = s => boardSizeFor(s.prestige) ** 2;
// A smart player places their best dice: if the board is full, a stronger die bumps the weakest onto the shelf.
function obtain(s, spec) {
  s.collection.add(spec.tier + ":" + spec.color);
  if (s.board.length < s.cells) { s.board.push(spec); return; }
  let wi = 0; for (let i = 1; i < s.board.length; i++) if (dieMult(s.board[i].tier, s.board[i].level) < dieMult(s.board[wi].tier, s.board[wi].level)) wi = i;
  if (dieMult(spec.tier, spec.level) > dieMult(s.board[wi].tier, s.board[wi].level)) { s.storage.push(s.board[wi]); s.board[wi] = spec; }
  else s.storage.push(spec);
}
function openCrate(s, luck) {
  s.points -= crateCost(s);
  let tier = pickTier(luck); if (s.cratesOpened === 0) tier = Math.max(tier, 2);
  const shiny = Math.random() < SHINY_BASE * luck;
  s.cratesOpened++; s.crateRun++; obtain(s, { tier, color: rnd(COLORS), level: 0, shiny });
}
// One spending pass. Policy: the crate is the chase — buy it whenever it's available and affordable. Unlock a cell
// only when a die is waiting for it (storage non-empty) — filling an empty board is never the cheap first move.
// Spare points go to combos then speed, alternating, so scoring keeps pace with the growing collection.
function spend(s, luck, gt) {
  for (;;) {
    let acted = false;
    if (s.lifetime >= CRATE_UNLOCK && gt >= (s.crateReadyAt || 0) && s.points >= crateCost(s)) { openCrate(s, luck); s.crateReadyAt = gt + CRATE_CD; s.everSpent = true; acted = true; continue; }
    if (s.storage.length && s.cells < maxCells(s) && s.points >= COST.cell(s)) { s.points -= COST.cell(s); s.cells++; s.board.push(s.storage.shift()); s.everSpent = true; acted = true; continue; }
    const canCombo = comboOf(s) < comboCap(s.prestige), canSpeed = rollMsOf(s) > rollFloor(s.prestige);
    const cCombo = COST.combo(s), cSpeed = COST.speed(s);
    // only spend on upgrades if we're not saving toward a crate we can almost afford
    const savingForCrate = s.lifetime >= CRATE_UNLOCK && s.points < crateCost(s) && s.points > crateCost(s) * .5;
    if (!savingForCrate) {
      if (canCombo && s.points >= cCombo && (s.comboLv <= s.speedLv || !canSpeed)) { s.points -= cCombo; s.comboLv++; s.everSpent = true; acted = true; continue; }
      if (canSpeed && s.points >= cSpeed) { s.points -= cSpeed; s.speedLv++; s.everSpent = true; acted = true; continue; }
    }
    if (!acted) return;
  }
}

// opts: { active } — active = a present player tapping ROLL (interval = manual floor); idle = the timer only.
//       { buyer }  — re-ups a 15-min ×2 Luck Boost whenever it lapses.
function run(label, opts = {}) {
  const { active, buyer } = opts;
  const s = fresh(); let gt = 0, luckUntil = 0;
  const marks = {};
  const mark = (k, extra) => { if (marks[k] === undefined) { marks[k] = gt; if (extra !== undefined) marks[k + "_x"] = extra; } };
  const topTier = () => Math.max(...[...s.collection].map(k => +k.split(":")[0]));
  const DAY = 24 * 3600;
  for (let step = 0; step < 50_000_000; step++) {
    const luck = buyer && gt < luckUntil ? 2 : 1;
    if (buyer && gt >= luckUntil) luckUntil = gt + 15 * 60; // re-up the 15-min boost the moment it lapses
    const ms = active ? manualFloor(s) : rollMsOf(s); gt += ms / 1000;
    const gained = avgScore(s); s.points += gained; s.lifetime += gained; s.runPoints += gained;
    spend(s, luck, gt);
    if (s.everSpent) mark("firstBuy");
    if (s.cratesOpened >= 1) mark("firstCrate");
    if ([...s.collection].some(k => +k.split(":")[0] >= 2)) mark("firstRare");
    if ([...s.collection].some(k => +k.split(":")[0] >= 3)) mark("firstEpic");
    if ([...s.collection].some(k => +k.split(":")[0] >= 4)) mark("firstLegend");
    if ([...s.collection].some(k => +k.split(":")[0] >= 5)) mark("firstMythic");
    if (s.board.length >= maxCells(s) && s.cells >= maxCells(s)) mark("boardFull", s.cratesOpened);
    if (s.collection.size >= 30) mark("allKinds");
    // Prestige when a level is reachable AND the board is full this run (so the run's work is banked first).
    if (s.runPoints >= levelThreshold(s.prestige) && s.cells >= maxCells(s)) doPrestige(s);
    if (gt > 5 * DAY) break; // 5 game-days horizon (keeps the gate fast; top-tier is already clearly multi-day by here)
    if (marks.firstMythic !== undefined && marks.boardFull !== undefined) break;
  }
  const fmtT = sec => sec == null ? "—" : sec < 3600 ? `${Math.floor(sec / 60)}m${String(Math.floor(sec % 60)).padStart(2, "0")}s`
    : sec < 86400 ? `${(sec / 3600).toFixed(1)}h` : `${(sec / 86400).toFixed(1)}d`;
  console.log(`\n== ${label} ==`);
  console.log(`  first purchase       ${fmtT(marks.firstBuy)}`);
  console.log(`  first crate          ${fmtT(marks.firstCrate)}`);
  console.log(`  first Rare die       ${fmtT(marks.firstRare)}`);
  console.log(`  first Epic die       ${fmtT(marks.firstEpic)}`);
  console.log(`  first Legendary      ${fmtT(marks.firstLegend)}`);
  console.log(`  first Mythic         ${fmtT(marks.firstMythic)}`);
  console.log(`  board full (25)      ${fmtT(marks.boardFull)}${marks.boardFull_x ? `  (${marks.boardFull_x} crates)` : ""}`);
  console.log(`  all 30 kinds         ${fmtT(marks.allKinds)}`);
  console.log(`  crates opened        ${s.cratesOpened}   top tier ${["Common","Uncommon","Rare","Epic","Legendary","Mythic"][topTier()]}`);
}

run("ACTIVE free player (tapping ROLL)", { active: true });
run("IDLE free player (timer only)", {});
run("ACTIVE buyer (tapping + Luck Boost ×2)", { active: true, buyer: true });
console.log("");
