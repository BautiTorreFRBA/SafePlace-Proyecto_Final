const db = require('../config/database');

const buscarPorEmailParaLogin = async (email) => {
  const query = `
    SELECT
      u.id,
      u.id_empresa,
      u.nombre AS usuario_nombre,
      u.apellido AS usuario_apellido,
      u.email,
      u.password_hash,
      u.activo,
      COALESCE(
        jsonb_agg(to_jsonb(r) ORDER BY ur.id_rol) FILTER (WHERE r.id IS NOT NULL),
        '[]'::jsonb
      ) AS roles
    FROM usuario u
    LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id
    LEFT JOIN rol r ON r.id = ur.id_rol
    WHERE lower(u.email) = lower($1)
    GROUP BY
      u.id,
      u.id_empresa,
      u.nombre,
      u.apellido,
      u.email,
      u.password_hash,
      u.activo
    LIMIT 1;
  `;

  const result = await db.query(query, [email]);
  return result.rows[0] || null;
};

module.exports = {
  buscarPorEmailParaLogin,
};
