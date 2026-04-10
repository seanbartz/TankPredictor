#!/usr/bin/env node
// sim_consistency_test.js
//
// Verifies that the pick odds derived from lotteryPositionOdds × OFFICIAL_PICK_ODDS
// are always logically consistent: no team can show a non-zero pick probability for
// a pick that is unreachable given its simulated lottery position distribution.
//
// Run with: node sim_consistency_test.js

"use strict";

// ── Shared constants (kept in sync with app.js) ──────────────────────────────

const LOTTERY_COMBOS = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5];

// Pre-computed pick probability matrix (same as in app.js).
const OFFICIAL_PICK_ODDS = [
  [0.14012, 0.13420, 0.12749, 0.11959, 0.47859, 0, 0, 0, 0, 0, 0, 0, 0, 0], // seed 1
  [0.13997, 0.13413, 0.12733, 0.11978, 0.27852, 0.20027, 0, 0, 0, 0, 0, 0, 0, 0], // seed 2
  [0.13990, 0.13407, 0.12757, 0.11971, 0.14832, 0.26018, 0.07024, 0, 0, 0, 0, 0, 0, 0], // seed 3
  [0.12509, 0.12230, 0.11897, 0.11470, 0.07235, 0.25731, 0.16735, 0.02192, 0, 0, 0, 0, 0, 0], // seed 4
  [0.10501, 0.10541, 0.10552, 0.10532, 0.02221, 0.19598, 0.26746, 0.08688, 0.00622, 0, 0, 0, 0, 0], // seed 5
  [0.08997, 0.09194, 0.09419, 0.09628, 0, 0.08626, 0.29775, 0.20526, 0.03685, 0.00150, 0, 0, 0, 0], // seed 6
  [0.07499, 0.07797, 0.08129, 0.08525, 0, 0, 0.19719, 0.34104, 0.12889, 0.01306, 0.00030, 0, 0, 0], // seed 7
  [0.05991, 0.06347, 0.06749, 0.07219, 0, 0, 0, 0.34489, 0.32067, 0.06753, 0.00381, 0, 0, 0], // seed 8
  [0.04494, 0.04844, 0.05220, 0.05704, 0, 0, 0, 0, 0.50737, 0.25893, 0.03016, 0.00092, 0, 0], // seed 9
  [0.03003, 0.03273, 0.03599, 0.04011, 0, 0, 0, 0, 0, 0.65898, 0.18993, 0.01204, 0.00018, 0], // seed 10
  [0.02009, 0.02203, 0.02456, 0.02755, 0, 0, 0, 0, 0, 0, 0.77580, 0.12593, 0.00402, 0], // seed 11
  [0.01492, 0.01658, 0.01856, 0.02105, 0, 0, 0, 0, 0, 0, 0, 0.86106, 0.06705, 0.00077], // seed 12
  [0.01000, 0.01115, 0.01254, 0.01424, 0, 0, 0, 0, 0, 0, 0, 0, 0.92874, 0.02334], // seed 13
  [0.00506, 0.00558, 0.00629, 0.00720, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.97587], // seed 14
];

const TEAM_DATA = {
  ATL:{conf:"East"}, BOS:{conf:"East"}, BKN:{conf:"East"}, CHA:{conf:"East"},
  CHI:{conf:"East"}, CLE:{conf:"East"}, DET:{conf:"East"}, IND:{conf:"East"},
  MIA:{conf:"East"}, MIL:{conf:"East"}, NYK:{conf:"East"}, ORL:{conf:"East"},
  PHI:{conf:"East"}, TOR:{conf:"East"}, WAS:{conf:"East"},
  DAL:{conf:"West"}, DEN:{conf:"West"}, GSW:{conf:"West"}, HOU:{conf:"West"},
  LAC:{conf:"West"}, LAL:{conf:"West"}, MEM:{conf:"West"}, MIN:{conf:"West"},
  NOP:{conf:"West"}, OKC:{conf:"West"}, PHX:{conf:"West"}, POR:{conf:"West"},
  SAC:{conf:"West"}, SAS:{conf:"West"}, UTA:{conf:"West"},
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function groupByWins(teamList, wins, asc) {
  const groups = new Map();
  for (const team of teamList) {
    const w = wins[team] ?? 0;
    if (!groups.has(w)) groups.set(w, []);
    groups.get(w).push(team);
  }
  const keys = Array.from(groups.keys()).sort((a, b) => (asc ? a - b : b - a));
  return keys.map((w) => shuffle(groups.get(w)));
}

function rankConference(teams, wins, conf) {
  return groupByWins(teams.filter((t) => TEAM_DATA[t].conf === conf), wins, false).flat();
}

function orderLotteryTeams(lotteryTeams, wins) {
  return groupByWins(lotteryTeams, wins, true).flat();
}

function winProbability(strengths, home, away, boost) {
  const hs = strengths[home] ?? 0.5;
  const as = strengths[away] ?? 0.5;
  return Math.min(0.95, Math.max(0.05, hs / (hs + as) + boost));
}

function playGame(home, away, strengths, boost) {
  return Math.random() < winProbability(strengths, home, away, boost) ? home : away;
}

function simulatePlayIn(ranked, strengths, boost) {
  const s7 = ranked[6], s8 = ranked[7], s9 = ranked[8], s10 = ranked[9];
  const w78 = playGame(s7, s8, strengths, boost);
  const l78 = w78 === s7 ? s8 : s7;
  const w910 = playGame(s9, s10, strengths, boost);
  return [w78, playGame(l78, w910, strengths, boost)];
}

// ── Core computation (mirrors app.js simulate()) ──────────────────────────────

function computePickOdds(lotteryPositionOdds) {
  const teamList = Object.keys(lotteryPositionOdds);
  return Object.fromEntries(
    teamList.map((team) => {
      const posOdds = lotteryPositionOdds[team];
      const pickProbs = Array(14).fill(0);
      for (let seedIdx = 0; seedIdx < 14; seedIdx++) {
        if (posOdds[seedIdx] === 0) continue;
        for (let pickIdx = 0; pickIdx < 14; pickIdx++) {
          pickProbs[pickIdx] += posOdds[seedIdx] * OFFICIAL_PICK_ODDS[seedIdx][pickIdx];
        }
      }
      return [team, pickProbs];
    })
  );
}

function runSim(baseWins, remainingGames, sims) {
  const teamList = Object.keys(TEAM_DATA);
  const baseLosses = Object.fromEntries(
    teamList.map((t) => [t, Math.max(0, 82 - baseWins[t] - (remainingGames.filter((g) => g.home === t || g.away === t).length))])
  );
  const strengths = Object.fromEntries(
    teamList.map((t) => [t, Math.max(0.05, Math.min(0.95, baseWins[t] / 82))])
  );

  const lotteryPositionCounts = Object.fromEntries(teamList.map((t) => [t, Array(14).fill(0)]));

  for (let i = 0; i < sims; i++) {
    const wins = { ...baseWins };

    for (const game of remainingGames) {
      if (Math.random() < winProbability(strengths, game.home, game.away, 0.03)) {
        wins[game.home]++;
      } else {
        wins[game.away]++;
      }
    }

    const east = rankConference(teamList, wins, "East");
    const west = rankConference(teamList, wins, "West");

    const playoffTeams = new Set();
    east.slice(0, 6).forEach((t) => playoffTeams.add(t));
    west.slice(0, 6).forEach((t) => playoffTeams.add(t));
    simulatePlayIn(east, strengths, 0.03).forEach((t) => playoffTeams.add(t));
    simulatePlayIn(west, strengths, 0.03).forEach((t) => playoffTeams.add(t));

    const lotteryOrder = orderLotteryTeams(
      teamList.filter((t) => !playoffTeams.has(t)),
      wins
    );
    lotteryOrder.forEach((team, idx) => {
      if (team && idx < 14) lotteryPositionCounts[team][idx]++;
    });
  }

  const lotteryPositionOdds = Object.fromEntries(
    teamList.map((t) => [t, lotteryPositionCounts[t].map((c) => c / sims)])
  );
  const pickOdds = computePickOdds(lotteryPositionOdds);

  return { lotteryPositionOdds, pickOdds };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

// Test 1: OFFICIAL_PICK_ODDS matrix sanity checks
console.log("\nTest 1: OFFICIAL_PICK_ODDS matrix properties");

// Row sums should be 1 for each seed
for (let s = 0; s < 14; s++) {
  const sum = OFFICIAL_PICK_ODDS[s].reduce((a, b) => a + b, 0);
  assert(Math.abs(sum - 1.0) < 0.001, `Seed ${s + 1} probabilities sum to 1 (got ${sum.toFixed(4)})`);
}

// Column sums should be 1 for each pick
for (let p = 0; p < 14; p++) {
  const sum = OFFICIAL_PICK_ODDS.reduce((acc, row) => acc + row[p], 0);
  assert(Math.abs(sum - 1.0) < 0.001, `Pick ${p + 1} probabilities sum to 1 (got ${sum.toFixed(4)})`);
}

// A team can drop at most 4 spots: seed N can only get picks 1..N+4 (1-indexed)
for (let s = 0; s < 14; s++) {
  const maxAllowedPick = Math.min(13, s + 4); // 0-indexed
  for (let p = maxAllowedPick + 1; p < 14; p++) {
    assert(
      OFFICIAL_PICK_ODDS[s][p] === 0,
      `Seed ${s + 1} has 0 probability of pick ${p + 1} (impossible: would drop ${p - s} spots, max 4)`
    );
  }
}

// Test 2: Consistency - pick odds derived from lotteryPositionOdds are always
// reachable given those lottery positions.
console.log("\nTest 2: Pick odds consistency with current-season standings (no remaining games)");

const currentWins = {
  OKC:64, SAS:61, DET:58, BOS:54, DEN:52, NYK:51, CLE:51, HOU:50, LAL:50, MIN:47,
  ATL:45, TOR:44, ORL:44, PHX:44, PHI:43, CHA:43, MIA:41, LAC:41, POR:40, GSW:37,
  MIL:31, CHI:30, NOP:26, DAL:25, MEM:25, SAC:21, UTA:21, BKN:20, IND:18, WAS:17,
};

const { lotteryPositionOdds, pickOdds } = runSim(currentWins, [], 50000);

// For every team, the max reachable pick from their lottery positions must
// be >= the max pick with non-zero probability.
for (const team of Object.keys(TEAM_DATA)) {
  const maxSeedIdx = lotteryPositionOdds[team].findLastIndex((v) => v > 0);
  if (maxSeedIdx === -1) continue; // playoff team - skip
  const maxAllowedPickIdx = Math.min(13, maxSeedIdx + 4);
  const actualMaxPickIdx = pickOdds[team].findLastIndex((v) => v > 0.00001);
  assert(
    actualMaxPickIdx <= maxAllowedPickIdx,
    `${team}: max pick ${actualMaxPickIdx + 1} <= max allowed pick ${maxAllowedPickIdx + 1} (from seed ${maxSeedIdx + 1})`
  );
}

// Test 3: Scenario where WAS is always at lottery positions 1-2
// → pick odds must be 0 for picks 7+
console.log("\nTest 3: WAS locked to lottery positions 1-2 → pick odds 0 for picks 7+");

const lockedWins = { ...Object.fromEntries(Object.keys(TEAM_DATA).map((t) => [t, 50])) };
lockedWins["WAS"] = 10; // worst
lockedWins["IND"] = 11; // 2nd worst
// All other teams have 50 wins → always above WAS and IND

const { lotteryPositionOdds: lockedPos, pickOdds: lockedPick } = runSim(lockedWins, [], 20000);

const wasMaxPos = lockedPos["WAS"].findLastIndex((v) => v > 0);
assert(wasMaxPos <= 1, `WAS max lottery position is ${wasMaxPos + 1} (expected ≤ 2)`);

for (let p = 6; p < 14; p++) {
  assert(
    lockedPick["WAS"][p] === 0,
    `WAS pick ${p + 1} probability is 0 (WAS locked to positions 1-2, cannot fall further)`
  );
}

// Test 4: Lottery position coverage (all 14 lottery seeds are covered in each sim)
console.log("\nTest 4: All 14 lottery positions are assigned in every simulation");

const totalPositions = Object.values(lotteryPositionOdds)
  .reduce((acc, probs) => acc + probs.reduce((a, b) => a + b, 0), 0);
assert(
  Math.abs(totalPositions - 14) < 0.01,
  `Total lottery position probability sums to 14 (got ${totalPositions.toFixed(2)})`
);

const totalPickProbs = Object.values(pickOdds)
  .reduce((acc, probs) => acc + probs.reduce((a, b) => a + b, 0), 0);
assert(
  Math.abs(totalPickProbs - 14) < 0.1,
  `Total pick probability sums to 14 (got ${totalPickProbs.toFixed(2)})`
);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} assertions: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
