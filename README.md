# MyPB

Flask API + web frontend over `mypb.db`, a SQLite database of Italian fuel
stations (impianti) and their prices.

```
mypb/
├── mypb-api/     Flask API (gestore, aroundme, Swagger docs)
├── frontend/     Static HTML/CSS/JS webapp (table + map views)
└── docker-compose.yml
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
| `sort`   | no | `alpha` | `alpha` (by nomeImpianto) or `price` (cheapest first) |
| `order`  | no | `asc` | `asc` / `desc` |
| `fuel`   | required if `sort=price` | — | e.g. `Benzina`, `Gasolio` |
| `self`   | no | — | `0` (servito) / `1` (self) |

```bash
curl "http://localhost:5000/aroundme?lat=37.333935&lon=13.595533&radius=5&sort=price&fuel=Benzina"
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

Plain HTML/CSS/JS, no build step. Two tabs:

- **Around me** — search by coordinates (or "Usa posizione" geolocation),
  filter by radius/sort/fuel/type, view results as a table or on an
  OpenStreetMap/Leaflet map. Click a pin for a popup with a "Dettagli e
  prezzi" link into the gestore tab.
- **Cerca gestore** — look up a single station by `idImpianto`.

The API base URL is set in `config.js` (defaults to
`http://127.0.0.1:5000`) and editable at runtime from the page header.

### Run locally

```bash
cd frontend
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000`. Make sure the API is running too, and that
its CORS config (`flask-cors`, already enabled in `app.py`) allows the
frontend's origin.

## Docker deployment

```bash
cp .env.example .env   # set API_BASE_URL to the server's public IP/domain
docker compose up -d --build
```

- `api` — gunicorn-served Flask app, port `5000`. `mypb.db` is mounted
  read-only from `mypb-api/mypb.db`, not baked into the image.
- `frontend` — nginx-served static site, port `8080`. `API_BASE_URL` is
  templated into `config.js` at container startup, so the same image can
  target any API host.

**`API_BASE_URL` must be reachable from the browser**, not just from the
Docker host — a container-internal name like `http://api:5000` will not
work, since the frontend's JS calls it client-side.

No TLS or reverse proxy is set up; both services are exposed as plain
HTTP. Put a reverse proxy (Caddy, nginx + certbot, ...) in front for a
public-facing deployment.
