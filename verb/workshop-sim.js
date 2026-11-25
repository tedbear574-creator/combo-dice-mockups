// Economy check for the workshop prototype: a bot plays 30 minutes one way, and we print what a roll pays
// as it goes. Run: node verb/workshop-sim.js [seed]
const WS = require("./workshop-rules.js");
const N = WS.N;
let seed = Number(process.argv[2] || 7);
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// trip times in seconds (walking at 16 studs/s between the board and a machine, plus the lift and the machine)
const TRIP = { press: 6, stamp: 7, again: 1, kiln: 8 };
// board cells in the order a player fills them: centre outwards
const ORDER = [...Array(N * N).keys()].sort((a, b) => {
  const d = (i) => Math.abs(Math.floor(i / N) - 2) + Math.abs((i % N) - 2) + (i % N) * 0.01 + Math.floor(i / N) * 0.001;
  return d(a) - d(b);
});

function play(strategy, minutes) {
  const board = Array(N * N).fill(null);
  ORDER.slice(0, 6).forEach((i) => (board[i] = WS.newDie("plain")));
  let pts = 0, stamps = 0; const fired = {}; let t = 0, busy = 0, nextRoll = WS.ROLL_EVERY, tray = 2, pressT = 0;
  const log = [], window = [];
  const rollPay = () => {
    const g = board.map((d) => (d ? { num: d.faces[Math.floor(rnd() * 6)], mat: d.mat } : null));
    return WS.findHands(g).reduce((a, h) => a + h.pay, 0);
  };
  const act = () => {
    const empty = ORDER.find((i) => !board[i]);
    if (strategy === "idle") return 0;
    if (empty !== undefined && tray > 0 && (strategy === "fill" || pts < 10)) { tray--; board[empty] = WS.newDie("plain"); return TRIP.press; }
    if (strategy === "fill") return 0;
    // stamp the die closest to all sixes, several times per trip while affordable
    const dice = board.filter(Boolean).filter((d) => WS.stampCost(d, 6, stamps) !== null)
      .sort((a, b) => WS.count(b, 6) - WS.count(a, 6));
    let time = 0;
    // fire instead when the kiln's cheapest firing of a die with 4+ sixes costs less than the next stamp
    const kilnable = board.filter((d) => d && WS.count(d, 6) >= 4 && WS.fireCost(d, fired) !== null)
      .sort((a, b) => WS.fireCost(a, fired) - WS.fireCost(b, fired))[0];
    const nextStamp = dice.length ? WS.stampCost(dice[0], 6, stamps) : Infinity;
    if (strategy === "sixes" && kilnable && WS.fireCost(kilnable, fired) < nextStamp) {
      const c = WS.fireCost(kilnable, fired);
      if (pts < c) return 0;
      pts -= c; kilnable.spent += c; kilnable.mat = WS.nextMat(kilnable); fired[kilnable.mat] = (fired[kilnable.mat] || 0) + 1; return TRIP.kiln;
    }
    for (const d of dice.slice(0, 1)) {
      while (WS.stampCost(d, 6, stamps) !== null && pts >= WS.stampCost(d, 6, stamps)) {
        const c = WS.stampCost(d, 6, stamps); pts -= c; d.spent += c; stamps++; d.faces[WS.stampSlot(d, 6, rnd)] = 6;
        time += time ? TRIP.again : TRIP.stamp;
      }
    }
    if (time) return time;
    // every die all sixes on a full board: fire the cheapest
    if (!dice.length && empty === undefined) {
      const f = board.filter((d) => WS.fireCost(d, fired) !== null).sort((a, b) => WS.fireCost(a, fired) - WS.fireCost(b, fired))[0];
      if (f && pts >= WS.fireCost(f, fired)) { const c = WS.fireCost(f, fired); pts -= c; f.spent += c; f.mat = WS.nextMat(f); fired[f.mat] = (fired[f.mat] || 0) + 1; return TRIP.kiln; }
    }
    if (empty !== undefined && tray > 0) { tray--; board[empty] = WS.newDie("plain"); return TRIP.press; }
    return 0;
  };
  const MARKS = [1, 2, 3, 5, 10, 15, 20, 30];
  for (; t < minutes * 60; t += 0.5) {
    pressT += 0.5; if (pressT >= WS.PRESS_EVERY) { pressT = 0; tray = Math.min(WS.TRAY, tray + 1); }
    if (t >= nextRoll) { nextRoll += WS.ROLL_EVERY; const p = rollPay(); pts += p; window.push(p); }
    if (busy > 0) busy -= 0.5; else busy = act();
    const m = MARKS.find((x) => Math.abs(t + 0.5 - x * 60) < 0.25);
    if (m) {
      const avg = window.reduce((a, b) => a + b, 0) / Math.max(1, window.length); window.length = 0;
      const sixes = board.filter(Boolean).reduce((a, d) => a + WS.count(d, 6), 0);
      const mats = {}; board.filter(Boolean).forEach((d) => (mats[d.mat] = (mats[d.mat] || 0) + 1));
      log.push(`${String(m).padStart(3)} min  roll pays ~${Math.round(avg).toLocaleString().padStart(9)}  banked ${Math.round(pts).toLocaleString().padStart(10)}` +
        `  dice ${board.filter(Boolean).length}  sixes ${sixes}/${board.filter(Boolean).length * 6}  ${Object.entries(mats).map(([k, v]) => k + " " + v).join(", ")}`);
    }
  }
  return log;
}
for (const s of (process.argv[3] || "idle,fill,sixes").split(",")) { console.log(`\n${s}`); play(s, 30).forEach((l) => console.log(l)); }
