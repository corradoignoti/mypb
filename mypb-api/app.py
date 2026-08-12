"""
Flask API on mypb.db (SQLite).

Tables:
  anagrafica_impianti_attivi(idImpianto, Gestore, Bandiera, "Tipo Impianto",
                              "Nome Impianto", Indirizzo, Comune, Provincia,
                              Latitudine, Longitudine)
  prezzo_alle_8(idImpianto, descCarburante, prezzo, isSelf, dtComu)

Endpoints:
  GET /gestore/<id_impianto>
      -> anagrafica row + all fuel prices for that impianto.

  GET /aroundme?lat=<f>&lon=<f>&radius=<km>&sort=alpha|price&order=asc|desc
              &fuel=<descCarburante>&self=0|1
      -> impianti within radius km of (lat, lon).
      sort=alpha (default): alphabetical by "Nome Impianto".
      sort=price: cheapest first (ascending) by min(prezzo) of `fuel`
                  (fuel is required for sort=price; self=0/1 optional
                  to restrict to servito/self).
      order flips either sort (asc default, or desc).
"""
import math
import sqlite3

from flasgger import Swagger
from flask import Flask, g, jsonify, request
from flask_cors import CORS

DB_PATH = "mypb.db"

app = Flask(__name__)
CORS(app)  # allow frontend/ (served from another origin) to call the API
app.config["SWAGGER"] = {"title": "MyPB API", "uiversion": 3}
swagger = Swagger(app, template={
    "info": {
        "title": "MyPB API",
        "description": "Query gestori (impianti carburante) da mypb.db.",
        "version": "1.0.0",
    }
})


def get_db():
    db = getattr(g, "_db", None)
    if db is None:
        db = g._db = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
    return db


@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, "_db", None)
    if db is not None:
        db.close()


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def row_to_impianto(row):
    return {
        "idImpianto": row["idImpianto"],
        "gestore": row["Gestore"],
        "bandiera": row["Bandiera"],
        "tipoImpianto": row["Tipo Impianto"],
        "nomeImpianto": row["Nome Impianto"],
        "indirizzo": row["Indirizzo"],
        "comune": row["Comune"],
        "provincia": row["Provincia"],
        "latitudine": row["Latitudine"],
        "longitudine": row["Longitudine"],
    }


@app.get("/gestore/<id_impianto>")
def gestore(id_impianto):
    """
    Dati completi di un gestore/impianto.
    ---
    tags:
      - gestore
    parameters:
      - name: id_impianto
        in: path
        type: string
        required: true
        description: idImpianto da anagrafica_impianti_attivi
        example: "59183"
    responses:
      200:
        description: Anagrafica impianto + prezzi carburanti
        schema:
          type: object
          properties:
            idImpianto: {type: string}
            gestore: {type: string}
            bandiera: {type: string}
            tipoImpianto: {type: string}
            nomeImpianto: {type: string}
            indirizzo: {type: string}
            comune: {type: string}
            provincia: {type: string}
            latitudine: {type: string}
            longitudine: {type: string}
            prezzi:
              type: array
              items:
                type: object
                properties:
                  carburante: {type: string}
                  prezzo: {type: string}
                  isSelf: {type: string}
                  dataComunicazione: {type: string}
      404:
        description: idImpianto non trovato
    """
    db = get_db()
    row = db.execute(
        'SELECT * FROM anagrafica_impianti_attivi WHERE idImpianto = ?',
        (id_impianto,),
    ).fetchone()
    if row is None:
        return jsonify({"error": "idImpianto not found"}), 404

    prezzi = db.execute(
        'SELECT descCarburante, prezzo, isSelf, dtComu '
        'FROM prezzo_alle_8 WHERE idImpianto = ?',
        (id_impianto,),
    ).fetchall()

    data = row_to_impianto(row)
    data["prezzi"] = [
        {
            "carburante": p["descCarburante"],
            "prezzo": p["prezzo"],
            "isSelf": p["isSelf"],
            "dataComunicazione": p["dtComu"],
        }
        for p in prezzi
    ]
    return jsonify(data)


@app.get("/aroundme")
def aroundme():
    """
    Gestori entro un raggio dalla posizione cliente.
    ---
    tags:
      - aroundme
    parameters:
      - name: lat
        in: query
        type: number
        required: true
        example: 37.333935
      - name: lon
        in: query
        type: number
        required: true
        example: 13.595533
      - name: radius
        in: query
        type: number
        required: false
        default: 5
        description: raggio di ricerca in km
      - name: sort
        in: query
        type: string
        enum: [alpha, price]
        required: false
        default: alpha
        description: alpha = alfabetico su nomeImpianto; price = dal meno caro (richiede fuel)
      - name: order
        in: query
        type: string
        enum: [asc, desc]
        required: false
        default: asc
      - name: fuel
        in: query
        type: string
        required: false
        description: descCarburante, obbligatorio se sort=price (es. Benzina, Gasolio)
      - name: self
        in: query
        type: string
        enum: ["0", "1"]
        required: false
        description: filtra isSelf (0=servito, 1=self)
    responses:
      200:
        description: Lista impianti entro il raggio
        schema:
          type: object
          properties:
            center:
              type: object
              properties:
                lat: {type: number}
                lon: {type: number}
            radiusKm: {type: number}
            sort: {type: string}
            order: {type: string}
            count: {type: integer}
            results:
              type: array
              items:
                type: object
                properties:
                  idImpianto: {type: string}
                  gestore: {type: string}
                  bandiera: {type: string}
                  nomeImpianto: {type: string}
                  distanceKm: {type: number}
                  prezzo: {type: number}
      400:
        description: parametri mancanti o non validi
    """
    try:
        lat = float(request.args["lat"])
        lon = float(request.args["lon"])
    except (KeyError, ValueError):
        return jsonify({"error": "lat and lon query params (floats) are required"}), 400

    try:
        radius_km = float(request.args.get("radius", 5))
    except ValueError:
        return jsonify({"error": "radius must be a number"}), 400
    if radius_km <= 0:
        return jsonify({"error": "radius must be > 0"}), 400

    sort = request.args.get("sort", "alpha").lower()
    if sort not in ("alpha", "price"):
        return jsonify({"error": "sort must be 'alpha' or 'price'"}), 400

    order = request.args.get("order", "asc").lower()
    if order not in ("asc", "desc"):
        return jsonify({"error": "order must be 'asc' or 'desc'"}), 400

    fuel = request.args.get("fuel")
    if sort == "price" and not fuel:
        return jsonify({"error": "fuel is required when sort=price"}), 400

    is_self = request.args.get("self")
    if is_self is not None and is_self not in ("0", "1"):
        return jsonify({"error": "self must be 0 or 1"}), 400

    db = get_db()

    # bounding-box prefilter (cheap) before exact haversine filter
    deg = radius_km / 111.0  # ~111 km per degree latitude
    # Latitudine/Longitudine have TEXT affinity; CAST to REAL or a bare
    # BETWEEN does lexicographic string comparison and silently drops rows.
    rows = db.execute(
        'SELECT * FROM anagrafica_impianti_attivi '
        'WHERE CAST(Latitudine AS REAL) BETWEEN ? AND ? '
        'AND CAST(Longitudine AS REAL) BETWEEN ? AND ?',
        (lat - deg, lat + deg, lon - deg, lon + deg),
    ).fetchall()

    results = []
    for row in rows:
        try:
            rlat = float(row["Latitudine"])
            rlon = float(row["Longitudine"])
        except (TypeError, ValueError):
            continue
        dist = haversine_km(lat, lon, rlat, rlon)
        if dist <= radius_km:
            item = row_to_impianto(row)
            item["distanceKm"] = round(dist, 3)
            results.append(item)

    if sort == "price":
        price_query = (
            'SELECT idImpianto, MIN(CAST(prezzo AS REAL)) AS minPrezzo '
            'FROM prezzo_alle_8 WHERE descCarburante = ?'
        )
        params = [fuel]
        if is_self is not None:
            price_query += ' AND isSelf = ?'
            params.append(is_self)
        price_query += ' GROUP BY idImpianto'

        price_map = {
            r["idImpianto"]: r["minPrezzo"]
            for r in db.execute(price_query, params).fetchall()
        }

        # impianti with no price for this fuel go last
        for item in results:
            item["prezzo"] = price_map.get(item["idImpianto"])

        priced = [it for it in results if it["prezzo"] is not None]
        unpriced = [it for it in results if it["prezzo"] is None]
        priced.sort(key=lambda it: it["prezzo"], reverse=(order == "desc"))
        results = priced + unpriced  # no-price impianti always last
    else:
        results.sort(key=lambda it: (it["nomeImpianto"] or ""), reverse=(order == "desc"))

    return jsonify({
        "center": {"lat": lat, "lon": lon},
        "radiusKm": radius_km,
        "sort": sort,
        "order": order,
        "count": len(results),
        "results": results,
    })


if __name__ == "__main__":
    app.run(debug=True)
