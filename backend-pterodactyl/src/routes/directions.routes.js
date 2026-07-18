const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { preview, speedLimit } = require('../controllers/directions.controller');

const router = Router();

router.post('/preview', requireAuth, preview);
router.get('/speed-limit', requireAuth, speedLimit);

module.exports = router;
