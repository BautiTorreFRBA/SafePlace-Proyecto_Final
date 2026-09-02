const path = require('path');
const dns = require('dns');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

// Render no tiene salida IPv6: sin esto, Node resuelve smtp.gmail.com a un
// registro AAAA y el SMTP de nodemailer falla con ENETUNREACH.
dns.setDefaultResultOrder('ipv4first');

const app = require('./app');
const { getPool } = require('./config/database');
const estadoDispositivoService = require('./services/estadoDispositivo.service');
const inactividadProlongadaService = require('./services/inactividadProlongada.service');

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

    // H0006 + CP-E2E-04: detección de desconexión (sin datos / pulso
    // congelado) y, sobre esos eventos, alerta de inactividad prolongada
    // cuando la caída ocurre en horario laboral.
    setInterval(async () => {
      try {
        await estadoDispositivoService.chequearInactividad();
        await estadoDispositivoService.chequearLecturasTrabadas();
        await inactividadProlongadaService.chequear();
      } catch (error) {
        console.error('[Backend API] Error en el chequeo periódico de conexión:', error.message);
      }
    }, CHEQUEO_INACTIVIDAD_MS);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
