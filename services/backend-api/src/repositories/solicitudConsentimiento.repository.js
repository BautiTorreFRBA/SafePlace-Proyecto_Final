const db = require('../config/database');

const crear = async ({ idOperario, tokenHash, versionPolitica, expiraEn }) => {
  const result = await db.query(
    `INSERT INTO solicitud_consentimiento
      (id_operario, token_hash, version_politica, expira_en)
     VALUES ($1, $2, $3, $4)
     RETURNING id, id_operario, version_politica, expira_en, creado_en;`,
    [idOperario, tokenHash, versionPolitica, expiraEn],
  );
  return result.rows[0];
};

const obtenerValidaPorToken = async (tokenHash) => {
  const result = await db.query(
    `SELECT id, id_operario, version_politica, expira_en
     FROM solicitud_consentimiento
     WHERE token_hash = $1 AND usado_en IS NULL AND expira_en > now()
     LIMIT 1;`,
    [tokenHash],
  );
  return result.rows[0] || null;
};

const marcarUsada = async (id) => {
  const result = await db.query(
    `UPDATE solicitud_consentimiento
     SET usado_en = now()
     WHERE id = $1 AND usado_en IS NULL AND expira_en > now()
     RETURNING id;`,
    [id],
  );
  return result.rows[0] || null;
};

module.exports = { crear, obtenerValidaPorToken, marcarUsada };
