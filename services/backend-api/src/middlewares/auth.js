const jwt = require('jsonwebtoken');
const db = require('../config/database');

// El alcance del supervisor (área y turnos) se lee de la base en cada pedido y
// no del token: así un cambio hecho por el admin rige de inmediato, sin que el
// supervisor tenga que volver a iniciar sesión.
const alcanceActualDelSupervisor = async (idUsuario) => {
  const result = await db.query(
    'SELECT area_supervisada, turnos_supervisados FROM usuario WHERE id = $1 LIMIT 1',
    [idUsuario],
  );
  return result.rows[0] || null;
};

const auth = async (req, res, next) => {
  let decoded;
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }

  if (decoded.role === 'supervisor') {
    try {
      const alcance = await alcanceActualDelSupervisor(decoded.sub);
      decoded.areaSupervisada = alcance?.area_supervisada || null;
      decoded.turnosSupervisados = alcance?.turnos_supervisados || [];
    } catch (error) {
      return next(error);
    }
  }

  req.user = decoded;
  next();
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
    }
    next();
  };
};

module.exports = { auth, authorize };
