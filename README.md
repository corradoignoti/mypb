# MyPB

Flask API + web frontend to find nearby Italian fuel stations (impianti)
and compare prices, over `mypb.db` (SQLite). Mobile-first, installable as
a PWA, Material Design 3 styling, Italian UI.

Latest project version with daily updated data is available on [https://mypb.fizban.net](https://mypb.fizban.net)

```
mypb/
├── mypb-api/     Flask API (gestore, aroundme, Swagger docs)
├── frontend/     Static HTML/CSS/JS webapp (table + map views, PWA)
├── dev.sh        Run API + frontend together for local dev
├── license.txt   MIT
└── docker-compose.yml
```

## Get the code

```bash
git clone https://github.com/corradoignoti/mypb.git
cd mypb
```

Or, if you don't have `git`, download the ZIP and extract it:

```bash
curl -L -o mypb.zip https://github.com/corradoignoti/mypb/archive/refs/heads/master.zip
unzip mypb.zip && cd mypb-master
```

## Data

`mypb-api/mypb.db` holds two tables:

- `anagrafica_impianti_attivi` — station registry (idImpianto, Gestore,
  Bandiera, Nome Impianto, Indirizzo, Comune, Provincia, Latitudine,
  Longitudine, ...)
- `prezzo_alle_8` — fuel prices per station (idImpianto, descCarburante,
  prezzo, isSelf, dtComu)

The db file itself is not committed (see `mypb-api/.gitignore`). Rebuild it
from the CSVs in `mypb-api/source-files/` with:

```bash
cd mypb-api
./import_source_files.sh
```

## API (`mypb-api/`)

Every endpoint is also served under `/v1/` (e.g. `/v1/aroundme`). The mobile
apps use the `/v1/` routes, which must stay backward compatible once an app
version is in the stores; the web frontend keeps using the unprefixed ones.

### `GET /gestore/<id_impianto>`

Full registry data + all fuel prices for one station.

```bash
curl "http://localhost:5000/gestore/59183"
```

### `GET /aroundme`

Stations within a radius of a point.

| param    | required | default | notes |
|----------|----------|---------|-------|
| `lat`, `lon` | yes | — | client coordinates |
| `radius` | no | `5` | km |
| `sort`   | no | `alpha` | `alpha` (by nomeImpianto) or `price` (cheapest first, ties broken by distance) |
| `order`  | no | `asc` | `asc` / `desc` |
| `fuel`   | required if `sort=price` | — | e.g. `Benzina`, `Gasolio` |
| `self`   | no | — | `0` (servito) / `1` (self) |
| `limit`  | no | — | max results, applied after sorting |

`count` is the number of results returned, `total` the number of stations
within the radius (they differ only when `limit` cuts the list).

```bash
curl "http://localhost:5000/aroundme?lat=37.333935&lon=13.595533&radius=5&sort=price&fuel=Benzina"
```

### Brand logos

Every station in `/gestore` and `/aroundme` has a `bandieraLogo` field: the
file name of its brand logo, or `null` when the brand has none. Fetch the
image from `GET /logos/<file>` (or `/v1/logos/<file>`), e.g.
`/v1/logos/eni.svg`; responses are cacheable for a day. Clients draw their
own placeholder when it is `null` (the web frontend shows the brand's
initial in a circle coloured by a hash of the name).

Logos live in `mypb-api/logos/` and are mapped from the lowercased
`Bandiera` value in `BRAND_LOGOS` in `app.py`; sources are listed in
`mypb-api/logos/SOURCES.md`.

```bash
curl -O "http://localhost:5000/logos/eni.svg"
```

### `GET /status`

Prices update status, shown in the frontend footer.

- `dataEstrazione` — MIMIT extraction date of `prezzo_alle_8`, taken from
  the CSV banner line (`Estrazione del ...`)
- `dataImportazione` — ISO 8601 UTC timestamp of the import into `mypb.db`
- `ultimaComunicazione` — most recent `dtComu` among the prices

The first two come from the `import_info` table written by
`import_source_files.sh`; they are `null` for a db imported before that
table existed (re-run the importer).

```bash
curl "http://localhost:5000/status"
```

Interactive Swagger docs: `http://localhost:5000/apidocs/`

### Run locally

```bash
cd mypb-api
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
```

Serves on `http://127.0.0.1:5000` (Flask dev server, `debug=True`).

## Frontend (`frontend/`)

Plain HTML/CSS/JS, no build step, mobile-first responsive layout themed
with Material Design 3 (Roboto, elevation, filled/outlined/tonal
buttons). Two tabs:

- **Qui attorno** — on load, tries to geolocate and runs a default search
  automatically (falls back to a warning explaining why sharing location
  helps if denied/unsupported). Search starts as a short form (Indirizzo,
  Usa posizione, Carburante); "Ricerca avanzata" reveals Lat/Lon, Raggio,
  Ordina per, Ordine, Tipo. Results show as a table (tap a row for
  details) or an OpenStreetMap/Leaflet map with numbered pins. Numbers
  display with Italian decimal notation (`1,959`).
- **Cerca gestore** — look up a single station by `idImpianto`.

`about.html` and `privacy.html` are linked from the footer.
`privacy-ios.html` is the privacy policy of the iOS app (its App Store
privacy policy URL); keep it in sync with the app's in-app Privacy screen.
The app is
installable (manifest + service worker); a dismissible banner prompts
"Aggiungi a Home" on supported browsers, with manual instructions on iOS
Safari.

The API base URL is set in `config.js` (defaults to
`http://127.0.0.1:5000`), templated from `config.js.template` at
container startup (see Docker section) — no runtime UI control for it.

### Run locally

```bash
cd frontend
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000`. Make sure the API is running too, and that
its CORS config (`flask-cors`, already enabled in `app.py`) allows the
frontend's origin.

### Run both at once

```bash
./dev.sh
```

Creates `mypb-api/.venv` if missing, then runs the API (auto-reload) on
`:5000` and the frontend on `:8000` (override with `FRONTEND_PORT`).
Ctrl-C stops both.

## Docker deployment

```bash
# 1. build mypb.db if you haven't already (see Data section above)
cd mypb-api && ./import_source_files.sh && cd ..

# 2. set the public API URL the browser will call — replace with your
#    server's IP/domain and the api port (9050, mapped below)
cp .env.example .env
echo "API_BASE_URL=http://203.0.113.10:9050" > .env

# 3. build and start both containers
docker compose up -d --build

# 4. check they're up
docker compose ps
curl http://203.0.113.10:9050/apidocs/
```

Open `http://203.0.113.10:9080` for the frontend.

- `api` — gunicorn-served Flask app, host port `9050` (container `5000`).
  `mypb.db` is mounted read-only from `mypb-api/mypb.db`, not baked into
  the image — it must exist before `docker compose up` (step 1).
- `frontend` — nginx-served static site, host port `9080` (container
  `80`). `API_BASE_URL` is templated into `config.js` at container
  startup, so the same image can target any API host. `nginx.conf`
  sends `Cache-Control: no-cache` for HTML/JS/CSS so browsers and CDNs
  (e.g. Cloudflare) revalidate them and pick up a new deploy immediately.

**`API_BASE_URL` must be reachable from the browser**, not just from the
Docker host — a container-internal name like `http://api:5000` will not
work, since the frontend's JS calls it client-side.

No TLS or reverse proxy is set up; both services are exposed as plain
HTTP. Put a reverse proxy (Caddy, nginx + certbot, ...) in front for a
public-facing deployment.

### Prebuilt images

`.github/workflows/docker-publish.yml` builds both images (linux/amd64 and
linux/arm64) on every push to `master` and pushes them to GitHub Container
Registry, tagged `latest` and `sha-<short commit>`:

- `ghcr.io/corradoignoti/mypb-api`
- `ghcr.io/corradoignoti/mypb-frontend`

To use them instead of building locally, replace `build:` with `image:` in
`docker-compose.yml` (e.g. `image: ghcr.io/corradoignoti/mypb-api:latest`)
and run `docker compose pull && docker compose up -d`. New packages on
GHCR are private by default — make them public in the package settings,
or `docker login ghcr.io` on the server first.

## License

MIT — see `license.txt`.
