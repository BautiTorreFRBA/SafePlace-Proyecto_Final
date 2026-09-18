const db = require('../config/database');

const turnoSeguridadActual = (usuario = {}) => {
  if (usuario.role !== 'seguridad') return null;
  const hora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (hora >= 8 && hora < 12) return 'mañana';
  if (hora >= 12 && hora < 16) return 'tarde';
  if (hora >= 16 && hora < 20) return 'noche';
  return '__sin_turno_activo__';
};

const crear = async ({ idAlerta }) => {
  const query = `
    INSERT INTO notificacion (id_alerta)
    VALUES ($1)
    RETURNING *;
  `;
  const res = await db.query(query, [idAlerta]);
  return res.rows[0];
};

// H0015: panel operativo del supervisor, con el detalle de la condición
// (tipo de alerta + trabajador) resuelto igual que la bandeja de H0013.
const listar = async ({ leida, usuario = {} } = {}) => {
  const area = usuario.role === 'supervisor' ? usuario.areaSupervisada || '__sin_alcance__' : null;
  const turnos = usuario.role === 'supervisor' ? usuario.turnosSupervisados || [] : null;
  const turnoSeguridad = turnoSeguridadActual(usuario);
  const query = `
    SELECT
      n.id,
      n.id_alerta,
      n.fecha_hora,
      n.leida,
      n.fecha_lectura,
      a.estado AS estado_alerta,
      ta.nombre AS tipo_alerta,
      ta.prioridad,
      o.nombre AS operario_nombre,
      o.apellido AS operario_apellido
    FROM notificacion n
    JOIN alerta a ON a.id = n.id_alerta
    JOIN tipo_alerta ta ON ta.id = a.id_tipo_alerta
    LEFT JOIN medicion m ON m.id = a.id_medicion
    LEFT JOIN operario_seudonimo os ON os.id = COALESCE(m.id_seudonimo, a.id_seudonimo)
    LEFT JOIN operario o ON o.id = os.id_operario
    WHERE ($1::boolean IS NULL OR n.leida = $1)
      AND ($2::text IS NULL OR (o.area = $2 AND o.turno = ANY($3::varchar[])))
      AND ($4::text IS NULL OR o.turno = $4)
    ORDER BY n.fecha_hora DESC, n.id DESC;
  `;
  const res = await db.query(query, [leida, area, turnos, turnoSeguridad]);
  return res.rows;
};

const marcarLeida = async (id, usuario = {}) => {
  const area = usuario.role === 'supervisor' ? usuario.areaSupervisada || '__sin_alcance__' : null;
  const turnos = usuario.role === 'supervisor' ? usuario.turnosSupervisados || [] : null;
  const turnoSeguridad = turnoSeguridadActual(usuario);
  const query = `
    UPDATE notificacion n
    SET leida = TRUE, fecha_lectura = now()
    FROM alerta a
    LEFT JOIN medicion m ON m.id = a.id_medicion
    LEFT JOIN operario_seudonimo os ON os.id = COALESCE(m.id_seudonimo, a.id_seudonimo)
    LEFT JOIN operario o ON o.id = os.id_operario
    WHERE n.id = $1
      AND a.id = n.id_alerta
      AND ($2::text IS NULL OR (o.area = $2 AND o.turno = ANY($3::varchar[])))
      AND ($4::text IS NULL OR o.turno = $4)
    RETURNING n.*;
  `;
  const res = await db.query(query, [id, area, turnos, turnoSeguridad]);
  return res.rows[0];
};

module.exports = {
  crear,
  listar,
  marcarLeida,
};
