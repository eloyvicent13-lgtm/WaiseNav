const fs = require('fs');
const path = require('path');
const prisma = require('../services/prisma');

const FIXED_RADARS_FILE = path.join(__dirname, '..', '..', 'data', 'radars-fijos.json');

let fixedCache = null;
function loadFixedRadars() {
  if (fixedCache) return fixedCache;
  try {
    fixedCache = JSON.parse(fs.readFileSync(FIXED_RADARS_FILE, 'utf8'));
  } catch {
    fixedCache = [];
  }
  return fixedCache;
}

/**
 * GET /api/radars?lat&lng&radius_km=20
 * Returns fixed DGT radars (from data/radars-fijos.json, see
 * README-RADARES.md for how to refresh it) plus active community-reported
 * mobile radars, each tagged with `kind`.
 */
async function nearbyRadars(req, res, next) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Math.min(Number(req.query.radius_km) || 20, 60);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    const inBox = (p) =>
      p.lat >= lat - dLat && p.lat <= lat + dLat && p.lng >= lng - dLng && p.lng <= lng + dLng;

    const fixed = loadFixedRadars()
      .filter(inBox)
      .map((r, i) => ({
        id: `fixed-${i}-${r.lat}-${r.lng}`,
        kind: 'fixed',
        lat: r.lat,
        lng: r.lng,
        maxspeed_kmh: r.maxspeed_kmh ?? null,
        road: r.road ?? null,
      }));

    const reported = (
      await prisma.report.findMany({
        where: {
          type: 'radar_movil',
          expiresAt: { gt: new Date() },
          lat: { gte: lat - dLat, lte: lat + dLat },
          lng: { gte: lng - dLng, lte: lng + dLng },
        },
        select: { id: true, lat: true, lng: true },
        take: 100,
      })
    ).map((r) => ({ id: r.id, kind: 'reported', lat: r.lat, lng: r.lng, maxspeed_kmh: null, road: null }));

    return res.json({ radars: [...fixed, ...reported] });
  } catch (err) {
    next(err);
  }
}

module.exports = { nearbyRadars };
