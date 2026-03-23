const API_SCHEDULE_CDN = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_10.json";
const API_SCHEDULE_DATA = (seasonYear) =>
  `https://data.nba.com/data/10s/v2015/json/mobile_teams/nba/${seasonYear}/league/00_full_schedule.json`;

const LOTTERY_COMBOS = [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5];
// Require at least ~40% of the season's games to be completed (1,230 total)
// before trusting the CDN schedule; otherwise fall back to the legacy API.
const MIN_COMPLETED_GAMES = 500;

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

const comboPool = buildComboPool(LOTTERY_COMBOS);

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
    renderStandings(cachedData);
    ui.status.textContent = "Ready to simulate.";
  } catch (err) {
    console.error(err);
    ui.status.textContent = "Failed to load data. Try refreshing.";
  }
}

async function fetchSchedule() {
  const cdnData = await fetchJson(API_SCHEDULE_CDN).catch(() => null);
  if (cdnData && cdnData.leagueSchedule?.gameDates?.length) {
    const parsed = parseScheduleLeague(cdnData);
    const completedCount = parsed.filter((g) => isFinalGame(g)).length;
    if (completedCount >= MIN_COMPLETED_GAMES) {
      ui.meta.textContent = `Source: nba.com scheduleLeagueV2_10.json`;
      return parsed;
    }
  }

  const seasonYear = getSeasonYear();
  const legacyData = await fetchJson(API_SCHEDULE_DATA(seasonYear));
  ui.meta.textContent = `Source: data.nba.com ${seasonYear} full schedule`;
  return parseLegacySchedule(legacyData);
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

  return {
    standings,
    records,
    completedGames,
    remainingGames,
    teams,
    updatedAt: new Date(),
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

function renderStandings(data) {
  ui.meta.textContent = `${ui.meta.textContent} · Games played: ${data.completedGames.length} · Remaining: ${data.remainingGames.length}`;
  const rows = data.standings
    .map(
      (team) => `
        <tr>
          <td>${team.name}</td>
          <td>${team.conf}</td>
          <td>${team.wins}</td>
          <td>${team.losses}</td>
          <td>${(team.winPct * 100).toFixed(1)}%</td>
        </tr>`
    )
    .join("");

  ui.standingsTable.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Team</th>
          <th>Conf</th>
          <th>W</th>
          <th>L</th>
          <th>Win%</th>
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

  renderSeedOdds(simResult.seedOdds);
  renderPickOdds(simResult.pickOdds);

  const t1 = performance.now();
  ui.status.textContent = `Completed ${sims.toLocaleString()} sims in ${((t1 - t0) / 1000).toFixed(1)}s.`;
}

function simulate({ standings, remainingGames, recentWindow, recentWeight, sims, homeBoost }) {
  const teamList = standings.map((t) => t.team);
  const baseWins = Object.fromEntries(standings.map((t) => [t.team, t.wins]));
  const baseLosses = Object.fromEntries(standings.map((t) => [t.team, t.losses]));

  const strengths = computeStrengths(standings, recentWindow, recentWeight);

  const seedCounts = Object.fromEntries(teamList.map((t) => [t, Array(15).fill(0)]));
  const pickCounts = Object.fromEntries(teamList.map((t) => [t, Array(14).fill(0)]));

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

    const east = rankConference(teamList, wins, "East");
    const west = rankConference(teamList, wins, "West");

    east.forEach((team, idx) => seedCounts[team][idx]++);
    west.forEach((team, idx) => seedCounts[team][idx]++);

    const playoffTeams = new Set();
    east.slice(0, 6).forEach((team) => playoffTeams.add(team));
    west.slice(0, 6).forEach((team) => playoffTeams.add(team));

    const eastPlayInWinners = simulatePlayIn(east, strengths, homeBoost);
    const westPlayInWinners = simulatePlayIn(west, strengths, homeBoost);
    eastPlayInWinners.forEach((team) => playoffTeams.add(team));
    westPlayInWinners.forEach((team) => playoffTeams.add(team));

    const lotteryTeams = teamList.filter((team) => !playoffTeams.has(team));
    const lotteryOrder = orderLotteryTeams(lotteryTeams, wins);

    const picks = simulateLottery(lotteryOrder);
    picks.forEach((team, idx) => {
      if (team) pickCounts[team][idx]++;
    });
  }

  const seedOdds = Object.fromEntries(
    teamList.map((team) => [
      team,
      seedCounts[team].map((count) => count / sims),
    ])
  );

  const pickOdds = Object.fromEntries(
    teamList.map((team) => [
      team,
      pickCounts[team].map((count) => count / sims),
    ])
  );

  return { seedOdds, pickOdds };
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

function simulateLottery(lotteryOrder) {
  const winners = [];
  const selected = new Set();

  while (winners.length < 4) {
    const seedIdx = comboPool[Math.floor(Math.random() * comboPool.length)];
    const team = lotteryOrder[seedIdx];
    if (!team || selected.has(team)) continue;
    winners.push(team);
    selected.add(team);
  }

  const remaining = lotteryOrder.filter((team) => !selected.has(team));
  return [...winners, ...remaining];
}

function buildComboPool(odds) {
  const pool = [];
  odds.forEach((count, idx) => {
    for (let i = 0; i < count; i++) {
      pool.push(idx);
    }
  });
  return pool;
}

function renderSeedOdds(seedOdds) {
  const columns = Array.from({ length: 15 }, (_, i) => i + 1);
  const rows = Object.keys(seedOdds)
    .sort((a, b) => TEAM_DATA[a].name.localeCompare(TEAM_DATA[b].name))
    .map((team) => {
      const probs = seedOdds[team];
      const cells = columns
        .map((seedIdx) => `<td>${formatPct(probs[seedIdx - 1])}</td>`)
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
  const rows = Object.keys(pickOdds)
    .sort((a, b) => TEAM_DATA[a].name.localeCompare(TEAM_DATA[b].name))
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
