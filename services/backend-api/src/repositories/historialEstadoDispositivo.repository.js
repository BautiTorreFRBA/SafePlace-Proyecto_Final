const db = require('../config/database');

// `fechaHora` opcional: en operación normal no se pasa (default now()); los
// seeds y tests lo usan para simular una desconexión ya sostenida sin
// esperar en tiempo real (CP-E2E-04).
const registrarEstado = async (idDispositivo, estado, fechaHora = null) => {
  const query = `
    INSERT INTO historial_estado_dispositivo (id_dispositivo, estado, fecha_hora)
    VALUES ($1, $2, COALESCE($3, now()))
    RETURNING *;
  `;
  const res = await db.query(query, [idDispositivo, estado, fechaHora]);
  return res.rows[0];
};

const obtenerUltimoEstado = async (idDispositivo) => {
  const query = `
    SELECT * FROM historial_estado_dispositivo
    WHERE id_dispositivo = $1
    ORDER BY fecha_hora DESC, id DESC
    LIMIT 1;
  `;
  const res = await db.query(query, [idDispositivo]);
  return res.rows[0];
};

// H0006: dispositivos con asignación vigente cuya última actividad (la
// medición más reciente, o el inicio de la asignación si nunca mandó
// ninguna) tiene más de `minutos` de antigüedad, y cuyo último estado
// registrado todavía no es DESCONECTADO (para no insertar filas repetidas
// en cada corrida del chequeo periódico).
const listarDispositivosInactivos = async (minutos) => {
  const query = `
    SELECT d.id AS id_dispositivo
    FROM dispositivo d
    JOIN asignacion_dispositivo ad
      ON ad.id_dispositivo = d.id
      AND (ad.fecha_hasta IS NULL OR ad.fecha_hasta >= now())
    LEFT JOIN LATERAL (
      SELECT fecha_hora FROM medicion m
      WHERE m.id_dispositivo = d.id
      ORDER BY fecha_hora DESC LIMIT 1
    ) ultima_medicion ON true
    LEFT JOIN LATERAL (
      SELECT estado FROM historial_estado_dispositivo h
      WHERE h.id_dispositivo = d.id
      ORDER BY fecha_hora DESC LIMIT 1
    ) ultimo_estado ON true
    WHERE COALESCE(ultima_medicion.fecha_hora, ad.fecha_desde) < now() - ($1 || ' minutes')::interval
      AND COALESCE(ultimo_estado.estado, '') != 'DESCONECTADO';
  `;
  const res = await db.query(query, [minutos]);
  return res.rows;
};

// CP-E2E-04 ("wearable congelado"): dispositivos con asignación vigente,
// último estado != DESCONECTADO, cuyas últimas `minRepeticiones` mediciones
// tienen TODAS exactamente la misma frecuencia cardíaca (no nula). Un
// wearable fuera de la muñeca suele repetir la última pulsación; el hub la
// reenvía cada REPORT_INTERVAL. La variabilidad latido a latido real siempre
// mueve el entero, así que N idénticas seguidas => se trata como desconexión.
//
// Las `minRepeticiones` tienen que ser recientes y contiguas: sin el filtro
// de antigüedad, un dispositivo recién reconectado con muy pocas mediciones
// nuevas completaba el racha con mediciones VIEJAS de una sesión anterior
// (a veces horas antes) y se marcaba DESCONECTADO estando conectado de
// verdad. `VENTANA_MINUTOS` acota la racha a algo que pudo haber pasado en
// una sola sesión de conexión continua.
const VENTANA_MINUTOS_TRABADO = 5;
const listarDispositivosTrabados = async (minRepeticiones) => {
  const query = `
    WITH ultimas AS (
      SELECT
        m.id_dispositivo,
        m.frecuencia_cardiaca,
        m.fecha_hora,
        row_number() OVER (
          PARTITION BY m.id_dispositivo
          ORDER BY m.fecha_hora DESC, m.id DESC
        ) AS rn
      FROM medicion m
      WHERE m.fecha_hora >= now() - interval '${VENTANA_MINUTOS_TRABADO} minutes'
    ),
    trabados AS (
      SELECT id_dispositivo
      FROM ultimas
      WHERE rn <= $1
      GROUP BY id_dispositivo
      HAVING COUNT(*) = $1
        AND COUNT(DISTINCT frecuencia_cardiaca) = 1
        AND bool_and(frecuencia_cardiaca IS NOT NULL)
    )
    SELECT t.id_dispositivo
    FROM trabados t
    JOIN asignacion_dispositivo ad
      ON ad.id_dispositivo = t.id_dispositivo
      AND (ad.fecha_hasta IS NULL OR ad.fecha_hasta >= now())
    LEFT JOIN LATERAL (
      SELECT estado FROM historial_estado_dispositivo h
      WHERE h.id_dispositivo = t.id_dispositivo
      ORDER BY fecha_hora DESC, id DESC LIMIT 1
    ) ult ON true
    WHERE COALESCE(ult.estado, '') != 'DESCONECTADO';
  `;
  const res = await db.query(query, [minRepeticiones]);
  return res.rows;
};

// CP-E2E-04: dispositivos con asignación vigente cuyo ÚLTIMO evento de estado
// es DESCONECTADO, con una conexión real antes de esa desconexión (no "en
// algún momento del historial figura DESCONECTADO" — un dispositivo que
// nunca se conectó de verdad, o cuyo único registro es un DESCONECTADO de
// una sesión/asignación anterior, no califica).
//
// OJO: esto YA NO filtra por tolerancia — devuelve todo candidato desconectado
// vigente, sin importar desde cuándo. El "hace cuánto" que de verdad importa
// no es la marca de tiempo del evento (podría ser de antes de que el
// servicio arrancara a chequear), sino desde que inactividadProlongada.service
// lo detectó por primera vez (inactividad_candidato). Eso se resuelve ahí,
// no acá.
const listarDesconectadosParaAlerta = async () => {
  const query = `
    SELECT
      d.id AS id_dispositivo,
      ad.id_trabajador AS id_operario,
      ult.fecha_hora AS desconectado_desde
    FROM dispositivo d
    JOIN asignacion_dispositivo ad
      ON ad.id_dispositivo = d.id
      AND (ad.fecha_hasta IS NULL OR ad.fecha_hasta >= now())
    JOIN LATERAL (
      SELECT estado, fecha_hora
      FROM historial_estado_dispositivo h
      WHERE h.id_dispositivo = d.id
      ORDER BY fecha_hora DESC, id DESC
      LIMIT 1
    ) ult ON true
    WHERE ult.estado = 'DESCONECTADO'
      AND EXISTS (
        SELECT 1
        FROM historial_estado_dispositivo previo
        WHERE previo.id_dispositivo = d.id
          AND previo.estado = 'CONECTADO'
          AND previo.fecha_hora < ult.fecha_hora
      );
  `;
  const res = await db.query(query);
  return res.rows;
};

// H0007: estado de conexión vigente de todos los dispositivos, para la
// pantalla de administración.
const listarEstadoActual = async () => {
  const query = `
    SELECT
      d.id, d.marca, d.modelo, d.estado AS activo, d.direccion_mac,
      h.estado AS estado_conexion, h.fecha_hora AS ultima_actividad
    FROM dispositivo d
    LEFT JOIN LATERAL (
      SELECT estado, fecha_hora FROM historial_estado_dispositivo hh
      WHERE hh.id_dispositivo = d.id
      ORDER BY fecha_hora DESC LIMIT 1
    ) h ON true
    ORDER BY d.id;
  `;
  const res = await db.query(query);
  return res.rows;
};

module.exports = {
  registrarEstado,
  obtenerUltimoEstado,
  listarDispositivosInactivos,
  listarDispositivosTrabados,
  listarDesconectadosParaAlerta,
  listarEstadoActual,
};
