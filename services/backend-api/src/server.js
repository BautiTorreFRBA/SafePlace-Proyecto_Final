const path = require('path');
const dotenv = require('dotenv');

// Primero cargamos el .env del servicio. Si existe un .env raíz, lo usamos solo
// como respaldo sin pisar las variables ya definidas.
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
  override: false,
});

const app = require('./app');
const { getPool } = require('./config/database');

const PORT = process.env.PORT || 8000;

async function startServer() {
  try {
    const client = await getPool().connect();
    console.log('[Backend API] Connected to PostgreSQL');
    client.release();

    app.listen(PORT, () => {
      console.log(`[Backend API] Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
