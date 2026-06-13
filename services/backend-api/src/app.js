const express = require('express');
const cors = require('cors');
const errorMiddleware = require('./middlewares/error.middleware');

// Route imports
const authRoutes = require('./routes/auth.routes');
const measurementsRoutes = require('./routes/measurements.routes');
const alertsRoutes = require('./routes/alerts.routes');
const workersRoutes = require('./routes/workers.routes');
const devicesRoutes = require('./routes/devices.routes');
const healthRoutes = require('./routes/health.routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/measurements`, measurementsRoutes);
app.use(`${API_PREFIX}/alerts`, alertsRoutes);
app.use(`${API_PREFIX}/workers`, workersRoutes);
app.use(`${API_PREFIX}/devices`, devicesRoutes);
app.use('/health', healthRoutes);

// Error Handling Middleware
app.use(errorMiddleware);

module.exports = app;
