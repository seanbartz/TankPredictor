# TankPredictor

Static NBA season simulator designed for GitHub Pages. It:
- Fetches the full NBA schedule from public JSON endpoints
- Computes current standings from finished games
- Simulates the remaining schedule to estimate seed odds
- Runs the NBA lottery draw to get pick odds

## Run locally
Open `index.html` in a browser (or use any static server).

## GitHub Pages
Push the repo to GitHub and enable Pages in Settings → Pages → Deploy from branch (root).

## Data sources
This app pulls schedule data from NBA public JSON endpoints at runtime. If one source is empty, it falls back to the other.
