const LOCAL_SCHEDULE_PATH = "./data/scheduleLeagueV2_10.json";
const API_SCHEDULE_CDN = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_10.json";
const API_SCHEDULE_DATA = (seasonYear) =>
  `https://data.nba.com/data/10s/v2015/json/mobile_teams/nba/${seasonYear}/league/00_full_schedule.json`;

const LOTTERY_COMBOS = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5];

// Pre-computed pick probability matrix derived from LOTTERY_COMBOS.
// OFFICIAL_PICK_ODDS[seedIdx][pickIdx] = probability that the team at lottery
// seed (seedIdx+1) receives draft pick (pickIdx+1).
// seedIdx 0 = worst record (lottery seed 1), 13 = best record among lottery teams.
// pickIdx 0 = pick 1, 13 = pick 14.
// Computed via simulation of 10 million lottery draws; zero entries are exactly 0
// (impossible outcomes) because a team can drop at most 4 spots from its seed.
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

// Require at least ~40% of the season's games to be completed (1,230 total)
// before trusting the CDN schedule; otherwise fall back to the legacy API.
const MIN_COMPLETED_GAMES = 500;
const MIN_REGULAR_SEASON_GAMES = 1000;

const TEAM_DATA = {
  ATL: { name: "Atlanta Hawks", conf: "East" },
  BOS: { name: "Boston Celtics", conf: "East" },
  BKN: { name: "Brooklyn Nets", conf: "East" },
  CHA: { name: "Charlotte Hornets", conf: "East" },
  CHI: { name: "Chicago Bulls", conf: "East" },
  CLE: { name: "Cleveland Cavaliers", conf: "East" },
  DET: { name: "Detroit Pistons", conf: "East" },
  IND: { name: "Indiana Pacers", conf: "East" },
  MIA: { name: "Miami Heat", conf: "East" },
  MIL: { name: "Milwaukee Bucks", conf: "East" },
  NYK: { name: "New York Knicks", conf: "East" },
  ORL: { name: "Orlando Magic", conf: "East" },
  PHI: { name: "Philadelphia 76ers", conf: "East" },
  TOR: { name: "Toronto Raptors", conf: "East" },
  WAS: { name: "Washington Wizards", conf: "East" },
  DAL: { name: "Dallas Mavericks", conf: "West" },
  DEN: { name: "Denver Nuggets", conf: "West" },
  GSW: { name: "Golden State Warriors", conf: "West" },
  HOU: { name: "Houston Rockets", conf: "West" },
  LAC: { name: "LA Clippers", conf: "West" },
  LAL: { name: "Los Angeles Lakers", conf: "West" },
  MEM: { name: "Memphis Grizzlies", conf: "West" },
  MIN: { name: "Minnesota Timberwolves", conf: "West" },
  NOP: { name: "New Orleans Pelicans", conf: "West" },
  OKC: { name: "Oklahoma City Thunder", conf: "West" },
  PHX: { name: "Phoenix Suns", conf: "West" },
  POR: { name: "Portland Trail Blazers", conf: "West" },
  SAC: { name: "Sacramento Kings", conf: "West" },
  SAS: { name: "San Antonio Spurs", conf: "West" },
  UTA: { name: "Utah Jazz", conf: "West" },
};

const TEAM_ALIASES = {
  BKN: "BKN",
  BRK: "BKN",
  PHO: "PHX",
  NOH: "NOP",
  NOK: "NOP",
  SEA: "OKC",
};

const ui = {
  meta: document.getElementById("dataMeta"),
  status: document.getElementById("status"),
  runBtn: document.getElementById("runBtn"),
  simCount: document.getElementById("simCount"),
  recentWindow: document.getElementById("recentWindow"),
  recentWeight: document.getElementById("recentWeight"),
  recentWeightValue: document.getElementById("recentWeightValue"),
  homeBoost: document.getElementById("homeBoost"),
  homeBoostValue: document.getElementById("homeBoostValue"),
  standingsPanelTitle: document.getElementById("standingsPanelTitle"),
  standingsTable: document.getElementById("standingsTable"),
  seedOddsTable: document.getElementById("seedOddsTable"),
  pickOddsTable: document.getElementById("pickOddsTable"),
};

let cachedData = null;

ui.recentWeight.addEventListener("input", () => {
  ui.recentWeightValue.textContent = `${ui.recentWeight.value}%`;
});

ui.homeBoost.addEventListener("input", () => {
  ui.homeBoostValue.textContent = `${ui.homeBoost.value}%`;
});

ui.runBtn.addEventListener("click", () => {
  if (!cachedData) return;
  runSimulation();
});

init();

async function init() {
  ui.status.textContent = "Fetching schedule data…";
  try {
    const schedule = await fetchSchedule();
    cachedData = prepareData(schedule);
    if (!cachedData.completedGames.length) {
      throw new Error("No completed regular season games were parsed from the schedule feed.");
    }
    const snapshotDate = await fetchLastUpdated().catch(() => null);
    if (snapshotDate) {
      cachedData.updatedAt = snapshotDate;
    }
    renderStandings(cachedData);
    ui.meta.textContent = `Standings last updated ${formatUpdateTime(cachedData.updatedAt)} · ${cachedData.completedGames.length} games played`;
    ui.status.textContent = "Ready to simulate.";
  } catch (err) {
    console.error(err);
    ui.status.textContent = `Failed to load data: ${err.message}`;
  }
}

async function fetchLastUpdated() {
  const response = await fetch("./data/last_updated.txt", { cache: "no-cache" });
  if (!response.ok) return null;
  const text = (await response.text()).trim();
  const d = new Date(text + "T12:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

async function fetchSchedule() {
  const localData = await fetchJson(LOCAL_SCHEDULE_PATH).catch(() => null);
  if (localData && localData.leagueSchedule?.gameDates?.length) {
    const parsedLocal = parseScheduleLeague(localData);
    const localCompletedCount = parsedLocal.filter((g) => isFinalGame(g)).length;
    if (parsedLocal.length >= MIN_REGULAR_SEASON_GAMES && localCompletedCount >= MIN_COMPLETED_GAMES) {
      return parsedLocal;
    }
  }

  const cdnData = await fetchJson(API_SCHEDULE_CDN).catch(() => null);
  if (cdnData && cdnData.leagueSchedule?.gameDates?.length) {
    const parsed = parseScheduleLeague(cdnData);
    const completedCount = parsed.filter((g) => isFinalGame(g)).length;
    if (parsed.length >= MIN_REGULAR_SEASON_GAMES && completedCount >= MIN_COMPLETED_GAMES) {
      return parsed;
    }
  }

  const seasonYear = getSeasonYear();
  const legacyData = await fetchJson(API_SCHEDULE_DATA(seasonYear));
  const parsedLegacy = parseLegacySchedule(legacyData);
  const legacyCompletedCount = parsedLegacy.filter((g) => isFinalGame(g)).length;
  if (parsedLegacy.length < MIN_REGULAR_SEASON_GAMES || legacyCompletedCount < MIN_COMPLETED_GAMES) {
    throw new Error("No browser-safe schedule source was available. Refresh the local snapshot with sanity_check_records.py.");
  }
  return parsedLegacy;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

function parseScheduleLeague(data) {
  const games = [];
  for (const dateBlock of data.leagueSchedule.gameDates) {
    for (const game of dateBlock.games) {
      if (!isRegularSeasonGameId(game.gameId)) continue;
      const home = normalizeTeam(game.homeTeam.teamTricode);
      const away = normalizeTeam(game.awayTeam.teamTricode);
      if (!home || !away) continue;
      games.push({
        date: new Date(game.gameDateEst || game.gameDate || dateBlock.gameDate),
        gameId: game.gameId,
        home,
        away,
        homeScore: parseInt(game.homeTeam.score ?? "0", 10),
        awayScore: parseInt(game.awayTeam.score ?? "0", 10),
        status: game.gameStatus ?? game.gameStatusText,
        statusText: String(game.gameStatusText ?? "").trim(),
      });
    }
  }
  return games;
}

function parseLegacySchedule(data) {
  const games = [];
  const months = data?.lscd ?? [];
  for (const month of months) {
    const gameBlocks = month?.mscd?.g ?? [];
    for (const game of gameBlocks) {
      if (!isRegularSeasonGameId(game.gid)) continue;
      const home = normalizeTeam(game.h?.ta);
      const away = normalizeTeam(game.v?.ta);
      if (!home || !away) continue;
      games.push({
        date: new Date(game.gdte),
        gameId: game.gid,
        home,
        away,
        homeScore: parseInt(game.h?.s ?? "0", 10),
        awayScore: parseInt(game.v?.s ?? "0", 10),
        status: game.st,
        statusText: String(game.stt ?? "").trim(),
      });
    }
  }
  return games;
}

function prepareData(games) {
  const teams = Object.keys(TEAM_DATA);
  const records = new Map();

  for (const team of teams) {
    records.set(team, { wins: 0, losses: 0, games: [] });
  }

  const completedGames = [];
  const remainingGames = [];

  for (const game of games) {
    const isFinal = isFinalGame(game);
    const hasDecidedScore =
      Number.isFinite(game.homeScore) &&
      Number.isFinite(game.awayScore) &&
      game.homeScore !== game.awayScore;

    if (isFinal && hasDecidedScore) {
      completedGames.push(game);
      const homeWin = game.homeScore > game.awayScore;
      updateRecord(records, game.home, homeWin, game.date);
      updateRecord(records, game.away, !homeWin, game.date);
    } else {
      remainingGames.push(game);
    }
  }

  const standings = teams.map((team) => {
    const rec = records.get(team);
    const wins = rec.wins;
    const losses = rec.losses;
    const winPct = wins + losses ? wins / (wins + losses) : 0.5;
    return {
      team,
      name: TEAM_DATA[team].name,
      conf: TEAM_DATA[team].conf,
      wins,
      losses,
      winPct,
      games: rec.games,
    };
  });

  standings.sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || a.losses - b.losses);

  const lastGameDate =
    completedGames.length > 0
      ? new Date(Math.max(...completedGames.map((g) => g.date.getTime())))
      : new Date();

  return {
    standings,
    records,
    completedGames,
    remainingGames,
    teams,
    updatedAt: lastGameDate,
  };
}

function updateRecord(records, team, win, date) {
  const rec = records.get(team);
  if (!rec) return;
  if (win) rec.wins += 1;
  else rec.losses += 1;
  rec.games.push({ date, win });
}

function isFinalGame(game) {
  const statusText = String(game.statusText ?? "").toLowerCase();
  if (statusText.includes("final")) return true;
  const status = Number(game.status);
  return status === 3;
}

function isRegularSeasonGameId(gameId) {
  return String(gameId ?? "").startsWith("002");
}

function normalizeTeam(code) {
  if (!code) return null;
  const upper = code.toUpperCase();
  const mapped = TEAM_ALIASES[upper] || upper;
  return TEAM_DATA[mapped] ? mapped : null;
}

function formatUpdateTime(date) {
  const MS_PER_DAY = 86400000;
  const etOptions = { timeZone: "America/New_York" };
  const isoFormatter = new Intl.DateTimeFormat("en-CA", {
    ...etOptions,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateET = isoFormatter.format(date);
  const nowET = isoFormatter.format(new Date());

  const [dateY, dateM, dateD] = dateET.split("-").map(Number);
  const [nowY, nowM, nowD] = nowET.split("-").map(Number);
  const dateMs = Date.UTC(dateY, dateM - 1, dateD);
  const nowMs = Date.UTC(nowY, nowM - 1, nowD);
  const diffDays = Math.round((nowMs - dateMs) / MS_PER_DAY);

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return new Intl.DateTimeFormat("en-US", { ...etOptions, month: "short", day: "numeric" }).format(date);
}

function renderStandings(data, winPredictions) {
  const hasPredictions = !!winPredictions;

  if (data.updatedAt) {
    ui.standingsPanelTitle.textContent = `Current Standings (updated ${formatUpdateTime(data.updatedAt)})`;
  }

  const rows = data.standings
    .map((team) => {
      const pred = hasPredictions ? winPredictions[team.team] : null;
      const predCells = pred
        ? `<td>${pred.mean}</td><td>${pred.min}</td><td>${pred.max}</td>`
        : hasPredictions
        ? `<td>—</td><td>—</td><td>—</td>`
        : "";
      return `
        <tr>
          <td>${team.name}</td>
          <td>${team.wins}</td>
          <td>${team.losses}</td>
          ${predCells}
        </tr>`;
    })
    .join("");

  const predHeaders = hasPredictions
    ? `<th>Pred W</th><th>Min W</th><th>Max W</th>`
    : "";

  ui.standingsTable.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Team</th>
          <th>W</th>
          <th>L</th>
          ${predHeaders}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function runSimulation() {
  const sims = Number(ui.simCount.value);
  const recentWindow = Number(ui.recentWindow.value);
  const recentWeight = Number(ui.recentWeight.value) / 100;
  const homeBoost = Number(ui.homeBoost.value) / 100;

  ui.status.textContent = "Running simulations…";
  const t0 = performance.now();

  const simResult = simulate({
    standings: cachedData.standings,
    remainingGames: cachedData.remainingGames,
    recentWindow,
    recentWeight,
    sims,
    homeBoost,
  });

  renderStandings(cachedData, simResult.winPredictions);
  renderLotteryPositionOdds(simResult.lotteryPositionOdds);
  renderPickOdds(simResult.pickOdds);

  const t1 = performance.now();
  ui.status.textContent = `Completed ${sims.toLocaleString()} sims in ${((t1 - t0) / 1000).toFixed(1)}s.`;
}

function simulate({ standings, remainingGames, recentWindow, recentWeight, sims, homeBoost }) {
  const teamList = standings.map((t) => t.team);
  const baseWins = Object.fromEntries(standings.map((t) => [t.team, t.wins]));
  const baseLosses = Object.fromEntries(standings.map((t) => [t.team, t.losses]));

  const strengths = computeStrengths(standings, recentWindow, recentWeight);

  const lotteryPositionCounts = Object.fromEntries(teamList.map((t) => [t, Array(14).fill(0)]));
  const winsByTeam = Object.fromEntries(teamList.map((t) => [t, []]));

  for (let i = 0; i < sims; i++) {
    const wins = { ...baseWins };
    const losses = { ...baseLosses };

    for (const game of remainingGames) {
      const pHome = winProbability(strengths, game.home, game.away, homeBoost);
      if (Math.random() < pHome) {
        wins[game.home] += 1;
        losses[game.away] += 1;
      } else {
        wins[game.away] += 1;
        losses[game.home] += 1;
      }
    }

    for (const team of teamList) {
      winsByTeam[team].push(wins[team]);
    }

    const east = rankConference(teamList, wins, "East");
    const west = rankConference(teamList, wins, "West");

    const playoffTeams = new Set();
    east.slice(0, 6).forEach((team) => playoffTeams.add(team));
    west.slice(0, 6).forEach((team) => playoffTeams.add(team));

    const eastPlayInWinners = simulatePlayIn(east, strengths, homeBoost);
    const westPlayInWinners = simulatePlayIn(west, strengths, homeBoost);
    eastPlayInWinners.forEach((team) => playoffTeams.add(team));
    westPlayInWinners.forEach((team) => playoffTeams.add(team));

    const lotteryTeams = teamList.filter((team) => !playoffTeams.has(team));
    const lotteryOrder = orderLotteryTeams(lotteryTeams, wins);
    lotteryOrder.forEach((team, idx) => {
      if (team && idx < 14) {
        lotteryPositionCounts[team][idx] += 1;
      }
    });
  }

  const lotteryPositionOdds = Object.fromEntries(
    teamList.map((team) => [
      team,
      lotteryPositionCounts[team].map((count) => count / sims),
    ])
  );

  // Derive pick odds directly from lottery position odds using the official pick
  // probability matrix. This guarantees that the pick odds table is always
  // mathematically consistent with the lottery position odds table: a team can
  // only show non-zero probability for a pick that is reachable from the lottery
  // positions it actually occupies in the simulations.
  const pickOdds = Object.fromEntries(
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

  const winPredictions = Object.fromEntries(
    teamList.map((team) => {
      const simWins = winsByTeam[team];
      const sorted = [...simWins].sort((a, b) => a - b);
      const mean = Math.round(simWins.reduce((a, b) => a + b, 0) / simWins.length);
      const min = sorted[Math.floor(0.05 * (sorted.length - 1))];
      const max = sorted[Math.floor(0.95 * (sorted.length - 1))];
      return [team, { mean, min, max }];
    })
  );

  return { lotteryPositionOdds, pickOdds, winPredictions };
}

function computeStrengths(standings, recentWindow, recentWeight) {
  const strengths = {};
  for (const team of standings) {
    const games = [...team.games].sort((a, b) => b.date - a.date);
    const recent = games.slice(0, recentWindow);
    const recentWinPct = recent.length ? recent.filter((g) => g.win).length / recent.length : team.winPct;
    const combined = (1 - recentWeight) * team.winPct + recentWeight * recentWinPct;
    strengths[team.team] = clamp(combined, 0.05, 0.95);
  }
  return strengths;
}

function winProbability(strengths, home, away, homeBoost) {
  const homeStrength = strengths[home] ?? 0.5;
  const awayStrength = strengths[away] ?? 0.5;
  const base = homeStrength / (homeStrength + awayStrength);
  return clamp(base + homeBoost, 0.05, 0.95);
}

function rankConference(teams, wins, conference) {
  const confTeams = teams.filter((team) => TEAM_DATA[team].conf === conference);
  const grouped = groupByWins(confTeams, wins, false);
  return grouped.flat();
}

function groupByWins(teamList, wins, asc) {
  const groups = new Map();
  for (const team of teamList) {
    const w = wins[team] ?? 0;
    if (!groups.has(w)) groups.set(w, []);
    groups.get(w).push(team);
  }
  const winTotals = Array.from(groups.keys()).sort((a, b) => (asc ? a - b : b - a));
  return winTotals.map((w) => shuffle(groups.get(w)));
}

function simulatePlayIn(rankedTeams, strengths, homeBoost) {
  const seed7 = rankedTeams[6];
  const seed8 = rankedTeams[7];
  const seed9 = rankedTeams[8];
  const seed10 = rankedTeams[9];

  const sevenEightWinner = playGame(seed7, seed8, strengths, homeBoost);
  const sevenEightLoser = sevenEightWinner === seed7 ? seed8 : seed7;
  const nineTenWinner = playGame(seed9, seed10, strengths, homeBoost);

  const eightSeedWinner = playGame(sevenEightLoser, nineTenWinner, strengths, homeBoost);
  return [sevenEightWinner, eightSeedWinner];
}

function playGame(home, away, strengths, homeBoost) {
  const pHome = winProbability(strengths, home, away, homeBoost);
  return Math.random() < pHome ? home : away;
}

function orderLotteryTeams(lotteryTeams, wins) {
  const grouped = groupByWins(lotteryTeams, wins, true);
  return grouped.flat();
}

function renderLotteryPositionOdds(lotteryPositionOdds) {
  const columns = Array.from({ length: 14 }, (_, i) => i + 1);
  const visibleTeams = Object.keys(lotteryPositionOdds)
    .filter((team) => lotteryPositionOdds[team].some((value) => value > 0));
  const rows = visibleTeams
    .sort((teamA, teamB) => compareProbabilityVectorsDescending(
      lotteryPositionOdds[teamA],
      lotteryPositionOdds[teamB],
      teamA,
      teamB
    ))
    .map((team) => {
      const probs = lotteryPositionOdds[team];
      const cells = columns
        .map((positionIdx) => `<td>${formatPct(probs[positionIdx - 1])}</td>`)
        .join("");
      return `<tr><td>${TEAM_DATA[team].name}</td>${cells}</tr>`;
    })
    .join("");

  ui.seedOddsTable.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Team</th>
          ${columns.map((c) => `<th>${c}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderPickOdds(pickOdds) {
  const columns = Array.from({ length: 14 }, (_, i) => i + 1);
  const visibleTeams = Object.keys(pickOdds)
    .filter((team) => pickOdds[team].some((value) => value > 0));
  const rows = visibleTeams
    .sort((a, b) => (pickOdds[b][0] ?? 0) - (pickOdds[a][0] ?? 0))
    .map((team) => {
      const probs = pickOdds[team];
      const cells = columns
        .map((pickIdx) => `<td>${formatPct(probs[pickIdx - 1])}</td>`)
        .join("");
      return `<tr><td>${TEAM_DATA[team].name}</td>${cells}</tr>`;
    })
    .join("");

  ui.pickOddsTable.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Team</th>
          ${columns.map((c) => `<th>${c}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function formatPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function compareProbabilityVectorsDescending(probsA, probsB, teamA, teamB) {
  const length = Math.max(probsA.length, probsB.length);
  for (let i = 0; i < length; i++) {
    const diff = (probsB[i] ?? 0) - (probsA[i] ?? 0);
    if (Math.abs(diff) > 1e-12) return diff;
  }
  return TEAM_DATA[teamA].name.localeCompare(TEAM_DATA[teamB].name);
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getSeasonYear() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() < 6 ? year - 1 : year;
}
