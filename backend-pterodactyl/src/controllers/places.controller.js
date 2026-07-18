const { searchNearbyPlaces, autocompletePlaces, placeDetails } = require('../services/places.service');

/**
 * GET /api/places/search?query=...&lat=...&lng=...&radius_km=5
 * Plain REST search — the "conventional" (non-AI) counterpart to the
 * search_nearby_places function-call tool used by the voice assistant.
 */
async function search(req, res, next) {
  try {
    const { query, lat, lng, radius_km: radiusKm } = req.query;
    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!query || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({ error: 'query, lat and lng are required' });
    }

    const results = await searchNearbyPlaces({
      query,
      lat: latNum,
      lng: lngNum,
      radiusMeters: (Number(radiusKm) || 5) * 1000,
    });

    return res.json({ results });
  } catch (err) {
    next(err);
  }
}

/** GET /api/places/autocomplete?input=...&lat=...&lng=... */
async function autocomplete(req, res, next) {
  try {
    const { input, lat, lng } = req.query;
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!input || input.length < 2 || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.json({ predictions: [] });
    }
    const predictions = await autocompletePlaces({ input, lat: latNum, lng: lngNum });
    return res.json({ predictions });
  } catch (err) {
    next(err);
  }
}

/** GET /api/places/details?place_id=... */
async function details(req, res, next) {
  try {
    const { place_id: placeId } = req.query;
    if (!placeId) return res.status(400).json({ error: 'place_id is required' });
    const place = await placeDetails(placeId);
    return res.json({ place });
  } catch (err) {
    next(err);
  }
}

module.exports = { search, autocomplete, details };
