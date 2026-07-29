const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../../.env'),
];

dotenv.config({
  path: envPaths.find((envPath) => fs.existsSync(envPath)),
});

const app = require('./app');
const { getPool } = require('./config/database');

const PORT = process.env.PORT || 8000;

async function startServer() {
  try {
    app.listen(PORT, () => {
      console.log(`[Backend API] Server is running on port ${PORT}`);
    });

    try {
      const client = await getPool().connect();
      console.log('[Backend API] Connected to PostgreSQL');
      client.release();
    } catch (dbError) {
      console.warn('[Backend API] Started without a live PostgreSQL connection:', dbError.message);
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
