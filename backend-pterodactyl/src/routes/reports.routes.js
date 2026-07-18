const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { createReport, nearbyReports } = require('../controllers/reports.controller');
const { nearbyRadars } = require('../controllers/radars.controller');

const router = Router();

router.post('/', requireAuth, createReport);
router.get('/', requireAuth, nearbyReports);

const radarsRouter = Router();
radarsRouter.get('/', requireAuth, nearbyRadars);

module.exports = { reportsRouter: router, radarsRouter };
