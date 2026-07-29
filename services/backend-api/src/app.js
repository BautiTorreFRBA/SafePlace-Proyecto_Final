const express = require('express');
const cors = require('cors');
const errorMiddleware = require('./middlewares/error.middleware');

// Route imports
const authRoutes = require('./routes/auth.routes');
const medicionesRoutes = require('./routes/mediciones.routes');
const alertasRoutes = require('./routes/alertas.routes');
const workersRoutes = require('./routes/workers.routes');
const devicesRoutes = require('./routes/devices.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const healthRoutes = require('./routes/health.routes');
const trabajadoresRoutes = require('./routes/trabajadores.routes');
const wearablesRoutes = require('./routes/wearables.routes');
const asociacionesRoutes = require('./routes/asociaciones.routes');

const app = express();

// Middlewares
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
// verify conserva el cuerpo crudo: si el JSON es corrupto, el manejador de
// errores audita el descarte con el hash del paquete original (RF-04/H0008).
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Routes
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/mediciones`, medicionesRoutes);
app.use(`${API_PREFIX}/alertas`, alertasRoutes);
app.use(`${API_PREFIX}/alerts`, alertasRoutes);
app.use(`${API_PREFIX}/workers`, workersRoutes);
app.use(`${API_PREFIX}/devices`, devicesRoutes);
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
app.use(`${API_PREFIX}/trabajadores`, trabajadoresRoutes);
app.use(`${API_PREFIX}/wearables`, wearablesRoutes);
app.use(`${API_PREFIX}/asociaciones`, asociacionesRoutes);
app.use('/health', healthRoutes);

// Error Handling Middleware
app.use(errorMiddleware);

module.exports = app;

