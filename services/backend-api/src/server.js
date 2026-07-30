const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

const app = require('./app');
const { getPool } = require('./config/database');
const estadoDispositivoService = require('./services/estadoDispositivo.service');

const PORT = process.env.PORT || 8000;
const CHEQUEO_INACTIVIDAD_MS = 60 * 1000;

async function startServer() {
  try {
    const client = await getPool().connect();
    console.log('[Backend API] Connected to PostgreSQL');
    client.release();

    app.listen(PORT, () => {
      console.log(`[Backend API] Server is running on port ${PORT}`);
    });

    // H0006: detección de desconexión por inactividad (ver estadoDispositivo.service).
    setInterval(() => {
      estadoDispositivoService.chequearInactividad().catch((error) => {
        console.error('[Backend API] Error chequeando inactividad de dispositivos:', error.message);
      });
    }, CHEQUEO_INACTIVIDAD_MS);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
