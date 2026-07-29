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
      throw new Error(`No se encontró un rol válido para '${rol}'.`);
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

const actualizarUsuario = async (id, { nombre, apellido, email, id_empresa, rol, activo, password }) => {
  const client = await db.getPool().connect();

  try {
    await client.query('BEGIN');

    const campos = [];
    const valores = [];
    let idx = 1;

    if (nombre !== undefined) {
      campos.push(`nombre = $${idx++}`);
      valores.push(nombre);
    }
    if (apellido !== undefined) {
      campos.push(`apellido = $${idx++}`);
      valores.push(apellido);
    }
    if (email !== undefined) {
      campos.push(`email = lower($${idx++})`);
      valores.push(email);
    }
    if (id_empresa !== undefined) {
      campos.push(`id_empresa = $${idx++}`);
      valores.push(id_empresa);
    }
    if (activo !== undefined) {
      campos.push(`activo = $${idx++}`);
      valores.push(activo);
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      campos.push(`password_hash = $${idx++}`);
      valores.push(passwordHash);
    }

    if (campos.length > 0) {
      valores.push(id);
      await client.query(`UPDATE usuario SET ${campos.join(', ')} WHERE id = $${idx};`, valores);
    }

    if (rol !== undefined) {
      const rolResult = await client.query(
        `
          SELECT id
          FROM rol
          WHERE lower(nombre) = lower($1)
             OR lower(rol) = lower($1)
             OR lower(codigo) = lower($1)
             OR lower(slug) = lower($1)
             OR lower(name) = lower($1)
             OR lower(tipo) = lower($1)
          LIMIT 1;
        `,
        [rol],
      );

      if (rolResult.rows[0]) {
        await client.query('DELETE FROM usuario_rol WHERE id_usuario = $1;', [id]);
        await client.query(
          'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2);',
          [id, rolResult.rows[0].id],
        );
      }
    }

    const result = await client.query(
      `
        SELECT
          u.id,
          u.nombre,
          u.apellido,
          u.email,
          u.id_empresa,
          e.nombre AS empresa_nombre,
          u.activo,
          COALESCE(
            jsonb_agg(to_jsonb(r) ORDER BY ur.id_rol) FILTER (WHERE r.id IS NOT NULL),
            '[]'::jsonb
          ) AS roles
        FROM usuario u
        LEFT JOIN empresa e ON e.id = u.id_empresa
        LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id
        LEFT JOIN rol r ON r.id = ur.id_rol
        WHERE u.id = $1
        GROUP BY u.id, e.nombre
        LIMIT 1;
      `,
      [id],
    );

    await client.query('COMMIT');
    return result.rows[0] || null;
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

