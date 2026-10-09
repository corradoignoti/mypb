# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MyPB finds nearby Italian fuel stations (impianti) and compares prices. Two independent parts:

- `mypb-api/` — single-file Flask API (`app.py`) over a SQLite db `mypb.db`, Swagger docs via flasgger at `/apidocs/`.
- `frontend/` — plain HTML/CSS/JS PWA, no build step, no framework. Italian UI, Material Design 3 styling, Leaflet/OpenStreetMap map, Nominatim for address geocoding.

No test suite, linter, or formatter is configured.

## Commands

```bash
./dev.sh                              # API on :5000 (Flask debug/auto-reload) + frontend on :8000 (FRONTEND_PORT to override); creates mypb-api/.venv if missing

# Data (run from mypb-api/)
./download_mimit_csv.sh               # fetch prezzo_alle_8.csv + anagrafica_impianti_attivi.csv from mimit.gov.it into source-files/
./import_source_files.sh              # rebuild mypb.db from source-files/*.csv (each CSV -> table of same name, full replace)

# Docker
docker compose up -d --build          # api on host :9050, frontend on host :9080; requires mypb-api/mypb.db to exist and API_BASE_URL in .env
```

## Architecture notes

- **Data is not committed.** `mypb.db` and `source-files/` are gitignored. The db is mounted read-only into the api container, so it can be swapped without rebuilding.
- **All db columns are TEXT.** The importer stores every CSV column as TEXT (column names keep spaces, e.g. `"Nome Impianto"`, so they must be quoted in SQL). Numeric comparisons in SQL need `CAST(... AS REAL)` — a bare `BETWEEN` on `Latitudine`/`Longitudine` does a string comparison and silently drops rows.
- **MIMIT CSV format:** line 1 is a banner (skipped), line 2 the pipe-separated header, no quoting (the data contains stray `"` characters, which is why the importer uses Python's `csv` with `QUOTE_NONE` instead of sqlite3 `.import`).
- **`/aroundme` flow:** bounding-box prefilter in SQL (~111 km/degree), then exact haversine filter in Python. With `sort=price`, it takes the min price per station for the given `fuel` (optionally filtered by `self`), sorts priced stations by price with distance as a tie-breaker (two stable sorts), and always puts stations without a price last regardless of `order`.
- **API responses use camelCase keys** mapped from db column names in `row_to_impianto()`; the frontend relies on these names.
- **Frontend API base URL** comes from `window.APP_CONFIG.apiBase` in `frontend/config.js`. In Docker, `docker-entrypoint.d/40-envsubst-config.sh` regenerates `config.js` from `config.js.template` using `API_BASE_URL` at container startup. That URL is called from the browser, so it must be publicly reachable (not `http://api:5000`).
- **Service worker** (`sw.js`) does no caching; it exists only to meet PWA installability criteria.
- When changing API parameters or response shape, update the flasgger YAML docstring on the endpoint, the module docstring in `app.py`, and the API section of `README.md`.
