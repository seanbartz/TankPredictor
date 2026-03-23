#!/usr/bin/env python3

import csv
import json
import sys
from pathlib import Path
from urllib.request import Request, urlopen


SCHEDULE_URL = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_10.json"
OUTPUT_DIR = Path("/Users/seanbartz/TankPredictor/debug")
DATA_DIR = Path("/Users/seanbartz/TankPredictor/data")
JSON_PATH = OUTPUT_DIR / "scheduleLeagueV2_10.json"
CSV_PATH = OUTPUT_DIR / "records.csv"
APP_JSON_PATH = DATA_DIR / "scheduleLeagueV2_10.json"

TEAM_DATA = {
    "ATL": {"name": "Atlanta Hawks", "conf": "East"},
    "BOS": {"name": "Boston Celtics", "conf": "East"},
    "BKN": {"name": "Brooklyn Nets", "conf": "East"},
    "CHA": {"name": "Charlotte Hornets", "conf": "East"},
    "CHI": {"name": "Chicago Bulls", "conf": "East"},
    "CLE": {"name": "Cleveland Cavaliers", "conf": "East"},
    "DET": {"name": "Detroit Pistons", "conf": "East"},
    "IND": {"name": "Indiana Pacers", "conf": "East"},
    "MIA": {"name": "Miami Heat", "conf": "East"},
    "MIL": {"name": "Milwaukee Bucks", "conf": "East"},
    "NYK": {"name": "New York Knicks", "conf": "East"},
    "ORL": {"name": "Orlando Magic", "conf": "East"},
    "PHI": {"name": "Philadelphia 76ers", "conf": "East"},
    "TOR": {"name": "Toronto Raptors", "conf": "East"},
    "WAS": {"name": "Washington Wizards", "conf": "East"},
    "DAL": {"name": "Dallas Mavericks", "conf": "West"},
    "DEN": {"name": "Denver Nuggets", "conf": "West"},
    "GSW": {"name": "Golden State Warriors", "conf": "West"},
    "HOU": {"name": "Houston Rockets", "conf": "West"},
    "LAC": {"name": "LA Clippers", "conf": "West"},
    "LAL": {"name": "Los Angeles Lakers", "conf": "West"},
    "MEM": {"name": "Memphis Grizzlies", "conf": "West"},
    "MIN": {"name": "Minnesota Timberwolves", "conf": "West"},
    "NOP": {"name": "New Orleans Pelicans", "conf": "West"},
    "OKC": {"name": "Oklahoma City Thunder", "conf": "West"},
    "PHX": {"name": "Phoenix Suns", "conf": "West"},
    "POR": {"name": "Portland Trail Blazers", "conf": "West"},
    "SAC": {"name": "Sacramento Kings", "conf": "West"},
    "SAS": {"name": "San Antonio Spurs", "conf": "West"},
    "UTA": {"name": "Utah Jazz", "conf": "West"},
}

TEAM_ALIASES = {
    "BRK": "BKN",
    "PHO": "PHX",
    "NOH": "NOP",
    "NOK": "NOP",
    "SEA": "OKC",
}


def normalize_team(code):
    if not code:
        return None
    code = code.upper()
    code = TEAM_ALIASES.get(code, code)
    return code if code in TEAM_DATA else None


def fetch_schedule():
    req = Request(
        SCHEDULE_URL,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )
    with urlopen(req, timeout=30) as response:
        return json.load(response)


def parse_games(payload):
    dates = payload["leagueSchedule"]["gameDates"]
    for date_block in dates:
        for game in date_block["games"]:
            if not is_regular_season_game_id(game["gameId"]):
                continue
            home = normalize_team(game["homeTeam"]["teamTricode"])
            away = normalize_team(game["awayTeam"]["teamTricode"])
            if not home or not away:
                continue
            yield {
                "game_id": game["gameId"],
                "game_date": game["gameDateEst"],
                "status": game["gameStatus"],
                "status_text": str(game["gameStatusText"]).strip(),
                "home": home,
                "away": away,
                "home_score": int(game["homeTeam"]["score"]),
                "away_score": int(game["awayTeam"]["score"]),
            }


def is_regular_season_game_id(game_id):
    return str(game_id).startswith("002")


def compute_records(games):
    records = {
        team: {
            "team": team,
            "name": meta["name"],
            "conference": meta["conf"],
            "wins": 0,
            "losses": 0,
            "games_played": 0,
        }
        for team, meta in TEAM_DATA.items()
    }

    completed = 0
    skipped = 0
    for game in games:
        if game["status"] != 3 or not game["status_text"].startswith("Final"):
            skipped += 1
            continue
        if game["home_score"] == game["away_score"]:
            raise ValueError(f"Tied final score for game {game['game_id']}")

        completed += 1
        winner = game["home"] if game["home_score"] > game["away_score"] else game["away"]
        loser = game["away"] if winner == game["home"] else game["home"]
        records[winner]["wins"] += 1
        records[loser]["losses"] += 1
        records[winner]["games_played"] += 1
        records[loser]["games_played"] += 1

    return records, completed, skipped


def write_csv(records):
    rows = sorted(
        records.values(),
        key=lambda row: (-row["wins"], row["losses"], row["name"]),
    )
    with CSV_PATH.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["team", "name", "conference", "wins", "losses", "games_played"],
        )
        writer.writeheader()
        writer.writerows(rows)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = fetch_schedule()
    JSON_PATH.write_text(json.dumps(payload, indent=2))
    APP_JSON_PATH.write_text(json.dumps(payload))
    games = list(parse_games(payload))
    records, completed, skipped = compute_records(games)
    write_csv(records)

    print(f"saved_json={JSON_PATH}")
    print(f"saved_app_json={APP_JSON_PATH}")
    print(f"saved_csv={CSV_PATH}")
    print(f"games_total={len(games)}")
    print(f"games_completed={completed}")
    print(f"games_not_final={skipped}")

    for team in ("ATL", "OKC", "CLE", "BOS", "WAS"):
        row = records[team]
        print(f"{team},{row['wins']},{row['losses']},{row['games_played']}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"error={exc}", file=sys.stderr)
        raise
