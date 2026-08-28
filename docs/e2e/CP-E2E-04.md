# CP-E2E-04 — Detección de inactividad prolongada

> **Definición implementada:** "inactividad prolongada" = el wearable de un
> operario estuvo **DESCONECTADO** más que la tolerancia configurada
> (`umbral_riesgo.minutos_desconexion_tolerada`) **mientras el operario estaba
> dentro de su horario laboral** (`horario_operario`). Sacarse el wearable
> fuera del horario laboral no genera alerta.

## Componentes

| Pieza | Dónde |
|---|---|
| Config tolerancia (global) | `PUT /api/v1/umbrales` → `minutosDesconexionTolerada` — pantalla *Seguridad → Umbrales de Riesgo* |
| Config horario (por operario) | `GET/PUT /api/v1/trabajadores/:id/horario` — pantalla *Admin → Horarios Laborales* |
| Evento de desconexión | Hub (`report_connection_state`) **o** inferencia H0006 (`estadoDispositivo.chequearInactividad`, 5 min sin datos) **o** pulso congelado (`chequearLecturasTrabadas`) |
| Detección + alerta | `inactividadProlongada.service.chequear()` — corre cada 60 s desde `server.js` |
| Cierre | `POST /api/v1/dispositivos/:id/estado-conexion` con `CONECTADO` → cierra la alerta Activa |

Latencia ≈ `minutosDesconexionTolerada` + hasta 5 min (si el hub no reportó) + hasta 60 s (ciclo).

## Precondiciones

1. Operario activo con wearable asociado (`asignacion_dispositivo` vigente).
2. Consentimiento otorgado (para que las mediciones previas ingresen).
3. `umbral_riesgo` vigente con `minutos_desconexion_tolerada` (> 5).
4. `horario_operario` del operario cubre el momento de la prueba.
5. Supervisor operativo con sesión iniciada.

## Ejecución (con el hub / injector)

```bash
# 1-2. Historial de conexión + mediciones (crea el seudónimo)
python tools/inject_measurements.py \
  --backend-url "$BACKEND_URL" --api-key "$GATEWAY_API_KEY" \
  --device-id <ID> --fc 72 --fc-jitter 2 --actividad 0.1 \
  --count 5 --interval-seconds 10

# 3. Simular desconexión sostenida: insertar un evento DESCONECTADO
#    retrodatado (> tolerancia) en historial_estado_dispositivo.
#    Opción A — SQL directo:
#      INSERT INTO historial_estado_dispositivo (id_dispositivo, estado, fecha_hora)
#      VALUES (<ID>, 'DESCONECTADO', now() - interval '15 minutes');
#    Opción B — apagar el hub y esperar 5 min (inferencia H0006) + tolerancia.

# 4-6. El chequeo periódico (cada 60 s) genera la alerta.

# 7. Login supervisor -> "Alertas activas" muestra "INACTIVIDAD_PROLONGADA".
```

## Resultado esperado (checklist)

- [x] Calcula el tiempo de inactividad (`now() - fecha_hora` del evento DESCONECTADO vigente).
- [x] Genera alerta al superar la tolerancia **y en horario laboral**.
- [x] Alerta registrada y asociada al operario (`alerta.id_seudonimo`, sin `id_medicion`).
- [x] `GET /api/v1/alertas/activas` la lista con nombre/apellido del operario.
- [x] Se dispara la notificación (`notificacion` + `eventBus`).
- [x] Disponible para consulta histórica (`GET /api/v1/alertas/historico?desde=...`).
- [x] Fuera de horario / antes de la tolerancia / duplicado → no genera nada.
- [x] Al reconectar, la alerta pasa a `Cerrada`.

## Tests automatizados

- `tests/integration/inactividadProlongada.test.js` — end-to-end contra Postgres.
- `tests/services/inactividadProlongada.service.test.js` — unitario.
- `tests/repositories/historialEstadoDispositivo.repository.test.js` — `listarDesconectadosParaAlerta`, `listarDispositivosTrabados`.
