/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * Reconciliación puntual del esquema real de Neon contra lo que el código
 * actual (y las migraciones 003-006) asumen. `pgmigrations` en Neon estaba
 * vacía a pesar de que casi todas las tablas ya existían — el equipo migró
 * el esquema por fuera de node-pg-migrate en algún momento, y varias piezas
 * quedaron con nombres/valores de un diseño anterior (regla_alerta /
 * alerta_historial_estado / intervencion), sin que el motor de reglas
 * (H0010/H0011/H0012/H0023) ni las notificaciones (H0015) pudieran
 * funcionar contra esos datos.
 *
 * Escrita para ser un no-op segura en una base ya creada desde cero con las
 * migraciones 001-008 (chequea antes de tocar nada), y una reparación real
 * contra el estado encontrado en Neon el 30/07/2026:
 *   - umbral_riesgo no existía.
 *   - tipo_alerta tenía nombres 'Fatiga'/'Sobreesfuerzo'/'Inactividad' en
 *     vez de 'FATIGA'/'SOBREESFUERZO'/'INACTIVIDAD_PROLONGADA' (el motor de
 *     reglas busca por nombre exacto) y prioridad 'Alta' para sobreesfuerzo
 *     en vez de 'Crítica' (criterio de H0011).
 *   - notificacion tenía fecha_envio en vez de fecha_hora, y no tenía
 *     leida/fecha_lectura (H0015).
 *   - alerta.estado tenía valores 'activo'/'cerrada'/'enrevision' en vez de
 *     'Activa'/'Cerrada'/'Atendida' (H0013), y le faltaba el índice
 *     compuesto que usa el chequeo antiduplicado.
 *
 * No toca: medicion.id_trabajador (15 filas con dato real, precede a la
 * seudonimización de H0020) ni regla_alerta/alerta_historial_estado/
 * intervencion (11 filas de historial del diseño anterior) — son datos
 * reales que requieren una decisión del equipo, no una reconciliación
 * automática.
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS umbral_riesgo (
      id serial PRIMARY KEY,
      fc_fatiga integer NOT NULL,
      minutos_fatiga integer NOT NULL,
      fc_sobreesfuerzo integer NOT NULL,
      actividad_sobreesfuerzo numeric NOT NULL,
      minutos_inactividad integer NOT NULL,
      id_usuario integer REFERENCES usuario ON DELETE SET NULL,
      fecha_hora timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS umbral_riesgo_fecha_hora_index ON umbral_riesgo (fecha_hora);
  `);

  pgm.sql(`
    UPDATE tipo_alerta SET nombre = 'FATIGA' WHERE nombre = 'Fatiga';
    UPDATE tipo_alerta SET nombre = 'SOBREESFUERZO', prioridad = 'Crítica' WHERE nombre = 'Sobreesfuerzo';
    UPDATE tipo_alerta SET nombre = 'INACTIVIDAD_PROLONGADA' WHERE nombre = 'Inactividad';
  `);

  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notificacion' AND column_name = 'fecha_envio'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notificacion' AND column_name = 'fecha_hora'
      ) THEN
        ALTER TABLE notificacion RENAME COLUMN fecha_envio TO fecha_hora;
      END IF;
    END $$;

    ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS leida boolean NOT NULL DEFAULT false;
    ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS fecha_lectura timestamptz;
    CREATE INDEX IF NOT EXISTS notificacion_leida_fecha_hora_index ON notificacion (leida, fecha_hora);
  `);

  pgm.sql(`
    UPDATE alerta SET estado = 'Activa' WHERE estado = 'activo';
    UPDATE alerta SET estado = 'Cerrada' WHERE estado = 'cerrada';
    UPDATE alerta SET estado = 'Atendida' WHERE estado = 'enrevision';
    ALTER TABLE alerta ALTER COLUMN estado SET DEFAULT 'Activa';
    CREATE INDEX IF NOT EXISTS alerta_id_tipo_alerta_estado_index ON alerta (id_tipo_alerta, estado);
  `);
};

exports.down = false;
