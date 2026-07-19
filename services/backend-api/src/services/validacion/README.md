# Servicio de Validación de Datos — V1

Implementa **RF-04 (Validación de Datos)** / historia **H0008 – Validar Datos Recibidos** (Épica 4, PB-04, Release 2, caso de prueba CP-VAL-001). Intercepta todo paquete de mediciones que llega del Gateway BLE por `POST /api/v1/mediciones` **antes** de que se persista (H0009) o se evalúe contra reglas de negocio (RF-05/06/07, fuera de alcance en V1).

## Flujo

```
Gateway → deviceAuth (x-device-api-key) → mediciones.controller
        → mediciones.service.registrarMedicion(paquete, {ipOrigen})
             → validacion-datos.service.validarPaquete()   ← pipeline de validaciones
             → medicion.repository.crear()                 ← sólo si es válido
             → logAuditoria (log_auditoria)                ← sólo en descartes auditables
```

## Contrato de entrada (paquete del gateway)

```json
{
  "idDispositivo": 7,
  "timestamp": "2026-07-18T12:00:00.000Z",
  "frecuenciaCardiaca": 88,
  "nivelActividad": 0.5,
  "nivelInactividad": 0,
  "temperaturaCorporal": 36.6,
  "spo2": 98
}
```

- `idDispositivo`, `timestamp` y `frecuenciaCardiaca` son obligatorios; el resto opcional (nullable en `medicion`).
- `idDispositivo` es el id interno de la tabla `dispositivo` (decisión: el DER no define un identificador externo de wearable; el mapeo del serial Garmin al id interno es responsabilidad del gateway/aprovisionamiento).
- El `idTrabajador` **no** se acepta del gateway: se resuelve en el backend desde la asignación vigente (`asignacion_dispositivo`).

## Salidas

- **Válido** → `201` con la medición persistida. `fecha_hora` = timestamp declarado por el paquete (única marca de tiempo de la entidad `medicion`, tal cual el DER v1.1 — ver Decisiones).
- **Inválido** → `ErrorValidacion` tipado (`motivo`, `status`, `auditar`) que el error middleware traduce a la respuesta HTTP.

## Validaciones (en orden) y trazabilidad

| # | Validación | Motivo | HTTP | ¿Audita? | Requisito fuente |
|---|---|---|---|---|---|
| 1 | Estructura: JSON corrupto (body parser) o tipos incorrectos | `ESTRUCTURA_INVALIDA` | 400 | Sí | RF-04 "paquetes corruptos, estructuras de datos incompletas" |
| 2 | Campos obligatorios: `idDispositivo`, `timestamp`, `frecuenciaCardiaca` | `CAMPOS_INCOMPLETOS` | 400 | Sí | H0008 "identificador del wearable / timestamp obligatorios"; H0006 (la FC es el biodato central) |
| 3 | Rango biológico: 30–220 BPM inclusive | `FUERA_DE_RANGO` | 400 | Sí | H0008 "la frecuencia cardíaca debe estar entre 30 y 220 BPM" |
| 4 | Duplicado: mismo `id_dispositivo` + misma `fecha_hora` | `DUPLICADO` | 409 | Sí | H0008 "no se aceptan registros duplicados" (criterio documentado en la migración `20260719000001`) |
| 5a | Wearable existente y con trabajador asignado | `DISPOSITIVO_INVALIDO` | 400 | Sí | H0008 esc. alternativo "wearable inexistente"; H0006 |
| 5b | Consentimiento activo del trabajador | `SIN_CONSENTIMIENTO` | 403 | **No** | Anexo "Bloqueo por Privacidad (Ley 25.326)"; RNF-09 |

## Decisiones documentadas (ambigüedades resueltas)

- **`fecha_hora` = timestamp del paquete (decisión de equipo, 18/07/2026)**: la entidad `medicion` se mantiene tal cual el DER v1.1, con `fecha_hora` como única marca de tiempo, y almacena la que declara el gateway. Es una desviación documentada respecto de RF-03 (que preveía una marca de recepción asignada por el backend): se priorizó no alterar el esquema del DER.
- **Criterio de duplicado**: el DER v1.1 no lo define. Se usa `id_dispositivo + fecha_hora`, el duplicado real que producen la cola local y los reintentos del gateway (reenvío del mismo paquete). Índice único → detección O(log n), sin escaneos (RNF-01), y defensa ante carreras (`ON CONFLICT DO NOTHING`).
- **Descarte por consentimiento NO se audita**: RNF-09 exige descarte "en memoria inmediatamente" y RF-04 sólo lista como auditables los casos de datos incompletos/fuera de rango. Auditar dejaría rastro de un biodato cuyo tratamiento el trabajador no consintió — se omite deliberadamente por minimización de datos (Ley 25.326).
- **Flag de consentimiento en caché** (RNF-09): caché en memoria con TTL (`CONSENTIMIENTO_CACHE_TTL_MS`, default 30 s) por trabajador, local a la instancia (RNF-03: sin estado compartido; reemplazable por caché distribuida). El futuro flujo de alta/revocación (H0019) debe llamar a `consentimiento.cache.invalidar(idTrabajador)`.
- **Tabla `registro_consentimiento` creada como prerequisito**: no existía en DER ni en código; sin ella el bloqueo por privacidad no puede implementarse. Sólo se construyó el lado de lectura; el registro/revocación (H0019) sigue pendiente.
- **Auditoría de descartes** reutiliza `log_auditoria` (operación `DESCARTE_VALIDACION`), sin sistema paralelo. Registra: motivo, `idDispositivo` extraíble, timestamp de captura declarado, hash SHA-256 del paquete original e IP de origen; la marca de recepción es el `fecha_hora` de la fila. **Nunca** registra el valor biométrico ni el `idTrabajador` (minimización, Ley 25.326).

## Tests

- Unitarios: `tests/services/validacion-datos.service.test.js` (6 escenarios de CP-VAL-001 con repositorios mockeados).
- Integración: `tests/integration/mediciones.ingesta.test.js` (endpoint real + PostgreSQL de test; flujo end-to-end del DoD de Release 2).
