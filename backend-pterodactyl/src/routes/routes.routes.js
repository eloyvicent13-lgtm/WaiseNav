const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { saveRoute, recentRoutes } = require('../controllers/routes.controller');

const router = Router();

router.post('/', requireAuth, saveRoute);
router.get('/', requireAuth, recentRoutes);

module.exports = router;
