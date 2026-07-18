const prisma = require('../services/prisma');

/** GET /api/favorites */
async function listFavorites(req, res, next) {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ favorites });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/favorites/:label — upsert (home / work / anything). */
async function setFavorite(req, res, next) {
  try {
    const label = req.params.label.toLowerCase();
    const { name, address, lat, lng } = req.body;
    if (!name || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'name, lat and lng are required' });
    }
    const favorite = await prisma.favorite.upsert({
      where: { userId_label: { userId: req.user.id, label } },
      update: { name, address: address || null, lat, lng },
      create: { userId: req.user.id, label, name, address: address || null, lat, lng },
    });
    return res.json({ favorite });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/favorites/:label */
async function deleteFavorite(req, res, next) {
  try {
    const label = req.params.label.toLowerCase();
    await prisma.favorite.deleteMany({ where: { userId: req.user.id, label } });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listFavorites, setFavorite, deleteFavorite };
