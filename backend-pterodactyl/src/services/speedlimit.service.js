/**
 * Speed limit lookup via Overpass (OSM `maxspeed` tag on the nearest
 * highway way). Overpass demo servers are rate-limited — the client must
 * throttle calls (the app queries every ~20s while navigating, cached by
 * rounded coordinate here as extra protection).
 */
const cache = new Map();
const CACHE_MAX = 500;

function cacheKey(lat, lng) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`; // ~100m buckets
}

async function getSpeedLimit({ lat, lng }) {
  const key = cacheKey(lat, lng);
  if (cache.has(key)) return cache.get(key);

  const query = `[out:json][timeout:5];way(around:30,${lat},${lng})["highway"]["maxspeed"];out tags 1;`;
  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Overpass rejects requests without an identifying UA (HTTP 406).
      'User-Agent': 'WaiseNav/1.0 (navigation app; speed limit lookup)',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!resp.ok) {
    throw Object.assign(new Error(`Overpass HTTP ${resp.status}`), {
      status: 502,
      publicMessage: 'Speed limit service unavailable',
    });
  }

  const data = await resp.json();
  const raw = data.elements?.[0]?.tags?.maxspeed;
  const parsed = raw ? parseInt(String(raw), 10) : NaN;
  const result = { maxspeed_kmh: Number.isNaN(parsed) ? null : parsed };

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

module.exports = { getSpeedLimit };
