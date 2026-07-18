const { getRoute } = require('../services/directions.service');
const { getSpeedLimit } = require('../services/speedlimit.service');

/**
 * POST /api/directions/preview
 * body: { originLat, originLng, destLat, destLng, mode?: 'driving'|'walking' }
 * Plain REST route+ETA lookup — used by the conventional search flow (tap a
 * result, see distance/time before committing to navigation).
 */
async function preview(req, res, next) {
  try {
    const { originLat, originLng, destLat, destLng, mode, waypoints } = req.body;
    const coords = [originLat, originLng, destLat, destLng].map(Number);

    if (coords.some((n) => Number.isNaN(n))) {
      return res.status(400).json({ error: 'originLat, originLng, destLat, destLng are required' });
    }

    const cleanWaypoints = Array.isArray(waypoints)
      ? waypoints
          .filter((w) => typeof w?.lat === 'number' && typeof w?.lng === 'number')
          .slice(0, 5)
      : [];

    const [oLat, oLng, dLat, dLng] = coords;
    const profile = ['walking', 'cycling', 'driving'].includes(mode) ? mode : 'driving';
    const route = await getRoute({
      originLat: oLat,
      originLng: oLng,
      destLat: dLat,
      destLng: dLng,
      profile,
      waypoints: cleanWaypoints,
    });

    return res.json({
      distance_meters: route.distanceMeters,
      duration_seconds: route.durationSeconds,
      geometry: route.geometry,
      steps: route.steps,
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/directions/speed-limit?lat&lng */
async function speedLimit(req, res, next) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }
    const result = await getSpeedLimit({ lat, lng });
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { preview, speedLimit };
