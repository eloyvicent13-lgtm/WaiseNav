const prisma = require('../services/prisma');

const VALID_TYPES = ['radar_movil', 'accidente', 'obstaculo', 'policia'];
const TTL_HOURS = 2;

/** POST /api/reports — Waze-style community report at current location. */
async function createReport(req, res, next) {
  try {
    const { type, lat, lng } = req.body;
    if (!VALID_TYPES.includes(type) || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: `type (${VALID_TYPES.join('|')}), lat, lng required` });
    }
    const report = await prisma.report.create({
      data: {
        userId: req.user.id,
        type,
        lat,
        lng,
        expiresAt: new Date(Date.now() + TTL_HOURS * 3600 * 1000),
      },
    });
    return res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
}

/** GET /api/reports?lat&lng&radius_km=15 — active nearby reports (all users). */
async function nearbyReports(req, res, next) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Math.min(Number(req.query.radius_km) || 15, 50);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    // Cheap bounding box filter — fine at these radii, no PostGIS needed.
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

    const reports = await prisma.report.findMany({
      where: {
        expiresAt: { gt: new Date() },
        lat: { gte: lat - dLat, lte: lat + dLat },
        lng: { gte: lng - dLng, lte: lng + dLng },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, type: true, lat: true, lng: true, createdAt: true },
    });
    return res.json({ reports });
  } catch (err) {
    next(err);
  }
}

module.exports = { createReport, nearbyReports };
