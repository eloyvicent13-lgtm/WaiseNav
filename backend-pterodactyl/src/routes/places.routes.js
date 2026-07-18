const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { search, autocomplete, details } = require('../controllers/places.controller');

const router = Router();

router.get('/search', requireAuth, search);
router.get('/autocomplete', requireAuth, autocomplete);
router.get('/details', requireAuth, details);

module.exports = router;
