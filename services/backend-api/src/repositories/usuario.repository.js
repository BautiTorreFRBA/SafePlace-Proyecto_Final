const db = require('../config/database');
const bcrypt = require('bcrypt');

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

const crearUsuario = async ({ nombre, apellido, email, password, id_empresa, rol, activo = true }) => {
  const client = await db.getPool().connect();

  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(password, 10);

    const usuarioInsert = await client.query(
      `
        INSERT INTO usuario (nombre, apellido, email, password_hash, id_empresa, activo)
        VALUES ($1, $2, lower($3), $4, $5, $6)
        RETURNING id, nombre, apellido, email, id_empresa, activo;
      `,
      [nombre, apellido, email, passwordHash, id_empresa, activo],
    );

    const usuario = usuarioInsert.rows[0];
    const rolNormalizado = String(rol || '').trim().toLowerCase();

    const rolResult = await client.query(
      `
        SELECT id, nombre
        FROM rol
        WHERE lower(nombre) = lower($1)
           OR lower(nombre) LIKE $2
        ORDER BY CASE
          WHEN lower(nombre) = lower($1) THEN 0
          ELSE 1
        END
        LIMIT 1;
      `,
      [rolNormalizado, `%${rolNormalizado}%`],
    );

    if (!rolResult.rows[0]) {
      throw new Error(`No se encontr� un rol v�lido para '${rol}'.`);
    }

    await client.query(
      'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2);',
      [usuario.id, rolResult.rows[0].id],
    );

    await client.query('COMMIT');

    return usuario;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const actualizarUsuario = async (id, { nombre, apellido, email, password, id_empresa, rol, activo }) => {
  const client = await db.getPool().connect();

  try {
    await client.query('BEGIN');

    const usuarioActual = await client.query(
      `
        SELECT id, nombre, apellido, email, id_empresa, activo
        FROM usuario
        WHERE id = $1
        LIMIT 1;
      `,
      [id],
    );

    if (!usuarioActual.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }

    const base = usuarioActual.rows[0];
    const nombreFinal = nombre ?? base.nombre;
    const apellidoFinal = apellido ?? base.apellido;
    const emailFinal = email ? String(email).trim().toLowerCase() : base.email;
    const empresaFinal = id_empresa ?? base.id_empresa;
    const activoFinal = typeof activo === 'boolean' ? activo : base.activo;

    const params = [id, nombreFinal, apellidoFinal, emailFinal, empresaFinal, activoFinal];
    const query = password
      ? `
        UPDATE usuario
        SET nombre = $2,
            apellido = $3,
            email = lower($4),
            id_empresa = $5,
            activo = $6,
            password_hash = $7
        WHERE id = $1
        RETURNING id, nombre, apellido, email, id_empresa, activo;
      `
      : `
        UPDATE usuario
        SET nombre = $2,
            apellido = $3,
            email = lower($4),
            id_empresa = $5,
            activo = $6
        WHERE id = $1
        RETURNING id, nombre, apellido, email, id_empresa, activo;
      `;

    if (password) {
      params.push(await bcrypt.hash(password, 10));
    }

    const usuarioUpdate = await client.query(query, params);

    if (rol) {
      const rolNormalizado = String(rol).trim().toLowerCase();
      const rolResult = await client.query(
        `
          SELECT id
          FROM rol
          WHERE lower(nombre) = lower($1)
             OR lower(nombre) LIKE $2
          ORDER BY CASE
            WHEN lower(nombre) = lower($1) THEN 0
            ELSE 1
          END
          LIMIT 1;
        `,
        [rolNormalizado, `%${rolNormalizado}%`],
      );

      if (!rolResult.rows[0]) {
        throw new Error(`No se encontro un rol valido para '${rol}'.`);
      }

      await client.query('DELETE FROM usuario_rol WHERE id_usuario = $1;', [id]);
      await client.query(
        'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2);',
        [id, rolResult.rows[0].id],
      );
    }

    await client.query('COMMIT');
    return usuarioUpdate.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  buscarPorEmailParaLogin,
  crearUsuario,
  actualizarUsuario,
};
