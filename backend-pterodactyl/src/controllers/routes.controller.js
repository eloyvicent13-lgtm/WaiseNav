const prisma = require('../services/prisma');

/** POST /api/routes — persist a started navigation for history. */
async function saveRoute(req, res, next) {
  try {
    const { destName, destLat, destLng, originLat, originLng, mode, source } = req.body;
    if (!destName || typeof destLat !== 'number' || typeof destLng !== 'number') {
      return res.status(400).json({ error: 'destName, destLat, destLng are required' });
    }
    const route = await prisma.route.create({
      data: {
        userId: req.user.id,
        destName,
        destLat,
        destLng,
        originLat: typeof originLat === 'number' ? originLat : 0,
        originLng: typeof originLng === 'number' ? originLng : 0,
        mode: mode || null,
        originSource: source || null,
      },
    });
    return res.status(201).json({ id: route.id });
  } catch (err) {
    next(err);
  }
}

/** GET /api/routes?limit=10 — recent history, deduped by destination name. */
async function recentRoutes(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const rows = await prisma.route.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
    const seen = new Set();
    const unique = [];
    for (const r of rows) {
      const key = r.destName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({
        id: r.id,
        destName: r.destName,
        destLat: r.destLat,
        destLng: r.destLng,
        mode: r.mode,
        createdAt: r.createdAt,
      });
      if (unique.length >= limit) break;
    }
    return res.json({ routes: unique });
  } catch (err) {
    next(err);
  }
}

module.exports = { saveRoute, recentRoutes };
