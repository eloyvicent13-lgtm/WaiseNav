# Radares fijos — cómo rellenar `data/radars-fijos.json`

El endpoint `GET /api/radars` sirve los radares fijos desde
`data/radars-fijos.json`. El archivo se distribuye vacío (`[]`) porque el
dataset oficial de la DGT no tiene URL estable para descarga automática —
no queremos inventar coordenadas.

## Formato

```json
[
  { "lat": 38.7793, "lng": -0.4348, "maxspeed_kmh": 90, "road": "N-340" },
  { "lat": 39.4699, "lng": -0.3763, "maxspeed_kmh": 50, "road": "V-30" }
]
```

`maxspeed_kmh` y `road` son opcionales.

## Fuente oficial

1. DGT publica la lista de radares fijos en https://www.dgt.es (buscar
   "radares fijos") y en datos.gob.es (dataset "Radares fijos DGT"),
   normalmente como CSV con columnas de carretera, PK y provincia (a veces
   sin coordenadas — hay que geocodificar el punto kilométrico).
2. Alternativa con coordenadas directas: OpenStreetMap tiene los radares
   mapeados como `highway=speed_camera`. Consulta Overpass:

```
[out:json][timeout:60];
node["highway"="speed_camera"](area:3600349035);
out;
```

(3600349035 = área de España). Exporta y transforma a este formato.

Tras editar el JSON, reinicia el servidor (el archivo se cachea en
memoria al primer uso).

Los radares móviles reportados por usuarios NO van aquí — salen de la
tabla `Report` (type `radar_movil`) automáticamente.
