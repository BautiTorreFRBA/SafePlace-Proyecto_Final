-- Semilla de 20 operarios de prueba para la simulación de carga
-- (tools/mediciones-sim). IDEMPOTENTE: se puede correr más de una vez, solo
-- crea lo que falta. Un único bloque DO, así corre igual desde el SQL Editor de
-- Neon, psql o cualquier cliente que acepte una sentencia por vez.
--
-- Por cada operario SIM-01..SIM-20 crea:
--   * operario (área, turno, sexo) y, si corresponde, su "Configuración
--     particular" de FC ("FC_Fatiga" / "FC_Sobreesfuerzo"); NULL = usa el umbral
--     global vigente (umbral_riesgo).
--   * wearable (dispositivo) con MAC sintética 02:5E:ED:00:00:NN, asignación
--     vigente y consentimiento biométrico otorgado.
--   * horario laboral (horario_operario) ligado a un `trabajo`, que define la
--     tolerancia de desconexión de ese puesto.
--
-- Horarios (hora de planta, Argentina; los turnos nocturnos que cruzan la
-- medianoche no están soportados, por eso "noche" es 20:00-23:59:59):
--   M = mañana 06:00-14:00 (lun-vie)   T = tarde 14:00-22:00 (lun-vie)
--   N = noche  20:00-23:59 (lun-vie)   G = guardia continua 24 h (lun-dom)
-- Las 2 guardias (SIM-19, SIM-20) garantizan que a cualquier hora haya
-- operarios dentro de horario para probar INACTIVIDAD_PROLONGADA.
--
-- Las tolerancias de desconexión de los `trabajo` (2-4 min) son valores de
-- prueba ACELERADOS, a propósito; para producción real usar >= 10.

DO $sembrar$
DECLARE
  v_empresa integer;
  r         record;
  v_op      integer;
  v_disp    integer;
  v_trab    integer;
  v_ini     time;
  v_fin     time;
  v_mac     text;
  nuevos_op integer := 0;
BEGIN
  SELECT id INTO v_empresa FROM empresa ORDER BY id LIMIT 1;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'No hay ninguna empresa cargada.';
  END IF;

  INSERT INTO trabajo (nombre, descripcion, activo, fc_fatiga, minutos_fatiga,
                       fc_sobreesfuerzo, actividad_sobreesfuerzo,
                       minutos_inactividad, minutos_desconexion_tolerada)
  VALUES
    ('Línea de producción',    'Puesto en línea (simulación de carga)',      true, 130, 5, 160, 0.7, 15, 3),
    ('Depósito y logística',   'Picking y movimiento de carga (simulación)', true, 130, 5, 160, 0.7, 15, 4),
    ('Mantenimiento de planta','Intervenciones en planta (simulación)',      true, 130, 5, 160, 0.7, 15, 4),
    ('Guardia continua',       'Cobertura 24 h (simulación)',                true, 130, 5, 160, 0.7, 15, 2)
  ON CONFLICT (nombre) DO NOTHING;

  FOR r IN
    SELECT * FROM (VALUES
      ( 1, 'SIM-01', 'Mateo',     'Gómez',     'Producción',    'mañana', 'masculino', 135, 165, 'M', 'Línea de producción'),
      ( 2, 'SIM-02', 'Lucía',     'Fernández', 'Producción',    'mañana', 'femenino',  125, 155, 'M', 'Línea de producción'),
      ( 3, 'SIM-03', 'Tomás',     'Rodríguez', 'Logística',     'mañana', 'masculino', NULL, NULL, 'M', 'Depósito y logística'),
      ( 4, 'SIM-04', 'Camila',    'Sosa',      'Logística',     'mañana', 'femenino',  NULL, NULL, 'M', 'Depósito y logística'),
      ( 5, 'SIM-05', 'Nicolás',   'Benítez',   'Mantenimiento', 'mañana', 'masculino', 140, 170, 'M', 'Mantenimiento de planta'),
      ( 6, 'SIM-06', 'Valeria',   'Acosta',    'Mantenimiento', 'mañana', 'femenino',  NULL, NULL, 'M', 'Mantenimiento de planta'),
      ( 7, 'SIM-07', 'Federico',  'Paz',       'Producción',    'mañana', 'masculino', NULL, NULL, 'M', 'Línea de producción'),
      ( 8, 'SIM-08', 'Julieta',   'Romero',    'Producción',    'tarde',  'femenino',  128, 158, 'T', 'Línea de producción'),
      ( 9, 'SIM-09', 'Gonzalo',   'Díaz',      'Producción',    'tarde',  'masculino', NULL, NULL, 'T', 'Línea de producción'),
      (10, 'SIM-10', 'Martina',   'Ruiz',      'Logística',     'tarde',  'femenino',  NULL, NULL, 'T', 'Depósito y logística'),
      (11, 'SIM-11', 'Ramiro',    'Castro',    'Logística',     'tarde',  'masculino', 138, 168, 'T', 'Depósito y logística'),
      (12, 'SIM-12', 'Agustina',  'Vega',      'Mantenimiento', 'tarde',  'femenino',  NULL, NULL, 'T', 'Mantenimiento de planta'),
      (13, 'SIM-13', 'Leandro',   'Molina',    'Mantenimiento', 'tarde',  'masculino', NULL, NULL, 'T', 'Mantenimiento de planta'),
      (14, 'SIM-14', 'Paula',     'Ibarra',    'Logística',     'tarde',  'femenino',  NULL, NULL, 'T', 'Depósito y logística'),
      (15, 'SIM-15', 'Damián',    'Herrera',   'Producción',    'noche',  'masculino', 132, 162, 'N', 'Línea de producción'),
      (16, 'SIM-16', 'Florencia', 'Luna',      'Producción',    'noche',  'femenino',  NULL, NULL, 'N', 'Línea de producción'),
      (17, 'SIM-17', 'Sebastián', 'Ortiz',     'Producción',    'noche',  'masculino', NULL, NULL, 'N', 'Línea de producción'),
      (18, 'SIM-18', 'Rocío',     'Méndez',    'Producción',    'noche',  'femenino',  126, 156, 'N', 'Línea de producción'),
      (19, 'SIM-19', 'Hernán',    'Silva',     'Mantenimiento', 'noche',  'masculino', NULL, NULL, 'G', 'Guardia continua'),
      (20, 'SIM-20', 'Natalia',   'Cabrera',   'Logística',     'noche',  'femenino',  NULL, NULL, 'G', 'Guardia continua')
    ) AS t(n, legajo, nombre, apellido, area, turno, sexo, fc_fat, fc_sob, horario, trabajo)
  LOOP
    -- operario
    SELECT id INTO v_op FROM operario WHERE id_empresa = v_empresa AND legajo = r.legajo;
    IF v_op IS NULL THEN
      INSERT INTO operario (id_empresa, legajo, nombre, apellido, area, estado, alta,
                            turno, sexo, "FC_Fatiga", "FC_Sobreesfuerzo")
      VALUES (v_empresa, r.legajo, r.nombre, r.apellido, r.area, true, current_date,
              r.turno, r.sexo, r.fc_fat, r.fc_sob)
      RETURNING id INTO v_op;
      nuevos_op := nuevos_op + 1;
    END IF;

    -- wearable
    v_mac := format('02:5E:ED:00:00:%s', upper(lpad(to_hex(r.n), 2, '0')));
    SELECT id INTO v_disp FROM dispositivo WHERE direccion_mac = v_mac;
    IF v_disp IS NULL THEN
      INSERT INTO dispositivo (marca, modelo, estado, direccion_mac, capacidades)
      VALUES ('SafePlace Sim', format('Carga-%s', lpad(r.n::text, 2, '0')), true, v_mac,
              '{"fc": true, "spo2": false, "temperatura": false}'::jsonb)
      RETURNING id INTO v_disp;
    END IF;

    -- asignación vigente
    IF NOT EXISTS (
      SELECT 1 FROM asignacion_dispositivo
      WHERE id_trabajador = v_op AND id_dispositivo = v_disp
        AND (fecha_hasta IS NULL OR fecha_hasta >= now())
    ) THEN
      INSERT INTO asignacion_dispositivo (id_trabajador, id_dispositivo, fecha_desde)
      VALUES (v_op, v_disp, now() - interval '1 day');
    END IF;

    -- consentimiento biométrico otorgado
    IF NOT EXISTS (
      SELECT 1 FROM registro_consentimiento WHERE id_operario = v_op AND estado = true
    ) THEN
      INSERT INTO registro_consentimiento (id_operario, estado, version_politica, fecha_hora)
      VALUES (v_op, true, 'v1.0', now());
    END IF;

    -- horario laboral
    IF NOT EXISTS (SELECT 1 FROM horario_operario WHERE id_operario = v_op) THEN
      SELECT id INTO v_trab FROM trabajo WHERE nombre = r.trabajo;
      v_ini := CASE r.horario WHEN 'M' THEN '06:00' WHEN 'T' THEN '14:00'
                              WHEN 'N' THEN '20:00' ELSE '00:00' END;
      v_fin := CASE r.horario WHEN 'M' THEN '14:00' WHEN 'T' THEN '22:00'
                              ELSE '23:59:59' END;
      INSERT INTO horario_operario (id_operario, dia_semana, hora_inicio, hora_fin, id_trabajo)
      SELECT v_op, d, v_ini, v_fin, v_trab
      FROM generate_series(1, CASE WHEN r.horario = 'G' THEN 7 ELSE 5 END) AS d;
    END IF;
  END LOOP;

  RAISE NOTICE 'Semilla de carga lista. Operarios nuevos: % (de 20).', nuevos_op;
END
$sembrar$;
