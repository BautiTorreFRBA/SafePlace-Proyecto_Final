# ADR-13 / ADR-14 — Inactividad prolongada y nivel de actividad

> Estos ADR deben incorporarse a la sección 13 del *Documento de Arquitectura*.
> También aplican cambios a las secciones 4, 5, 7, 8, 9 y 11 (ver más abajo).

## ADR-13 — "Inactividad prolongada" = desconexión del wearable en horario laboral

| | |
|---|---|
| **Estado** | Aceptada (MVP) |
| **Contexto** | H0012 / CP-E2E-04. El BLE Heart Rate Service del Garmin Forerunner 265 no expone nivel de actividad/movimiento. Detectar "el trabajador no se mueve" requeriría un acelerómetro o telemetría que el dispositivo no entrega. |
| **Decisión** | La condición de negocio "inactividad prolongada" se define como: **el wearable de un operario estuvo `DESCONECTADO` más que una tolerancia configurable (`umbral_riesgo.minutos_desconexion_tolerada`) mientras el operario estaba dentro de su horario laboral (`horario_operario`)**. Se evalúa periódicamente (cada 60 s, `inactividadProlongada.service`), no por medición. |
| **Alternativas** | (a) acelerómetro/IMU en la Pi — cambia el alcance de hardware; (b) proxy de FC como disparador — poco confiable para "quietud"; (c) umbral de no-movimiento sobre `medicion.actividad` — la actividad es un proxy, no una medición real. |
| **Consecuencias** | (+) Usa datos que el sistema ya tiene (eventos de conexión), sin hardware nuevo. (+) El horario por operario evita falsos positivos fuera de turno. (−) Depende de configurar `horario_operario` por operario y de un job periódico. (−) Latencia ≈ tolerancia + hasta 5 min (inferencia H0006) + hasta 60 s. |

Relación con H0006: H0006 **registra** el evento de desconexión (5 min sin
datos, o pulso congelado — ver ADR-14) para visibilidad del administrador;
H0012 genera la **alerta de negocio** cuando esa desconexión persiste en
horario laboral.

## ADR-14 — Nivel de actividad estimado en el gateway (proxy derivado de FC)

| | |
|---|---|
| **Estado** | Aceptada (MVP) |
| **Contexto** | El backend necesita `nivelActividad` para evaluar sobreesfuerzo (H0011) y para el monitoreo. El wearable no lo entrega por BLE. |
| **Decisión** | El gateway **estima** `nivelActividad` (0.0–1.0) a partir de la variación de corto plazo de la FC + el nivel por encima de la FC de reposo, cuantizando a 0.0 por debajo de un piso de movimiento. Modo conmutable (`ACTIVITY_MODE`: `hr-proxy` / `fixed` / `off`). |
| **Consecuencias** | (+) Habilita H0011 y el monitoreo sin hardware nuevo. (+) `fixed` permite tests deterministas. (−) Es una aproximación; no distingue tipos de esfuerzo. **No** dispara la alerta de inactividad prolongada. |

## Cambios al resto del documento

- **§4 / §5 / §7** — El gateway está implementado en **Python 3 (`bleak` + `aiohttp`)**, no Node.js; la cola local es **SQLite**.
- **§11** — El payload de `POST /api/v1/mediciones` incluye `nivelActividad` (opcional). Endpoints del hub: `GET /api/v1/dispositivos/lookup`, `POST /api/v1/dispositivos/:id/estado-conexion`.
- **§8 / §9** — Medida de respuesta de inactividad prolongada: desconexión en horario laboral > tolerancia configurable; guarda contra desconexión fuera de horario y contra pulso congelado.
- **Nueva config** — `umbral_riesgo.minutos_desconexion_tolerada` (global, Seguridad e Higiene, `PUT /api/v1/umbrales`); tabla `horario_operario` (por operario, `GET/PUT /api/v1/trabajadores/:id/horario`).
