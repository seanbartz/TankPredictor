# TankPredictor

Static NBA season simulator designed for GitHub Pages. It:
- Fetches the full NBA schedule from public JSON endpoints
- Computes current standings from finished games
- Simulates the remaining schedule to estimate seed odds
- Runs the NBA lottery draw to get pick odds

## Run locally
Open `index.html` in a browser (or use any static server).

## Refresh local data
Update the schedule snapshot and verification CSV with:

```bash
python3 sanity_check_records.py
```

Or use the helper script:

```bash
./update_standings.sh
```

This refreshes:
- `data/scheduleLeagueV2_10.json` for the browser app
- `data/records.csv` for a quick standings sanity check

## Automated refresh
GitHub Actions refreshes `data/scheduleLeagueV2_10.json` and `data/records.csv` once per day at `09:00 UTC`.
You can also trigger the same workflow manually from the Actions tab.

## GitHub Pages
Push the repo to GitHub and enable Pages in Settings → Pages → Deploy from branch (root).

## Data sources
The browser app reads from the local `data/scheduleLeagueV2_10.json` snapshot because the NBA schedule endpoints are not browser-safe for static hosting. The snapshot is produced by `sanity_check_records.py`, which fetches the official NBA CDN schedule server-side.
