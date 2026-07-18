const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const aiRoutes = require('./routes/ai.routes');
const placesRoutes = require('./routes/places.routes');
const directionsRoutes = require('./routes/directions.routes');
const routesRoutes = require('./routes/routes.routes');
const favoritesRoutes = require('./routes/favorites.routes');
const { reportsRouter, radarsRouter } = require('./routes/reports.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(morgan('tiny'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Landing page (static) served at the API root, per requirement that the
// landing page also lives on the same self-hosted server.
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/directions', directionsRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/reports', reportsRouter);
app.use('/api/radars', radarsRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
