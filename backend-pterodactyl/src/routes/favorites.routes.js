const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { listFavorites, setFavorite, deleteFavorite } = require('../controllers/favorites.controller');

const router = Router();

router.get('/', requireAuth, listFavorites);
router.put('/:label', requireAuth, setFavorite);
router.delete('/:label', requireAuth, deleteFavorite);

module.exports = router;
