-- Borra TODO lo que creó sembrar-carga.sql: los operarios SIM-01..SIM-20, sus
-- wearables (MAC 02:5E:ED:00:00:NN), asignaciones, consentimientos, horarios,
-- mediciones, alertas y notificaciones, historial de conexión y los `trabajo`
-- de simulación. Solo toca filas de simulación; no afecta operarios reales.
-- Un único bloque DO (corre desde el SQL Editor de Neon o psql).
--
-- El orden importa: alerta -> seudónimo y medicion -> consentimientos ->
-- operario (cascada a asignación, seudónimo y horario) -> dispositivo
-- (cascada a historial de conexión y candidatos de inactividad).

DO $limpiar$
DECLARE
  v_ops   integer[];
  v_disps integer[];
  v_seud  integer[];
BEGIN
  SELECT array_agg(id) INTO v_ops   FROM operario    WHERE legajo LIKE 'SIM-%';
  SELECT array_agg(id) INTO v_disps FROM dispositivo WHERE direccion_mac LIKE '02:5E:ED:00:00:%';
  SELECT array_agg(id) INTO v_seud  FROM operario_seudonimo WHERE id_operario = ANY(v_ops);

  DELETE FROM alerta WHERE id_seudonimo = ANY(v_seud);
  DELETE FROM medicion WHERE id_dispositivo = ANY(v_disps) OR id_seudonimo = ANY(v_seud);
  DELETE FROM registro_consentimiento   WHERE id_operario = ANY(v_ops);
  DELETE FROM solicitud_consentimiento  WHERE id_operario = ANY(v_ops);
  DELETE FROM operario    WHERE id = ANY(v_ops);
  DELETE FROM dispositivo WHERE id = ANY(v_disps);

  DELETE FROM trabajo t
  WHERE t.nombre IN ('Línea de producción', 'Depósito y logística',
                     'Mantenimiento de planta', 'Guardia continua')
    AND NOT EXISTS (SELECT 1 FROM horario_operario h WHERE h.id_trabajo = t.id);

  RAISE NOTICE 'Limpieza lista. Operarios borrados: %, dispositivos: %.',
    coalesce(array_length(v_ops, 1), 0), coalesce(array_length(v_disps, 1), 0);
END
$limpiar$;
