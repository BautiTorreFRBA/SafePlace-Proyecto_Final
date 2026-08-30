# Plan de pruebas E2E con simulador BLE en Mac

Arquitectura elegida:

```
Simulador BLE (Mac, CoreBluetooth Peripheral)
        │  BLE / GATT
        ▼
Raspberry Pi (hub, BLE Central)  ── ble_gateway.py
        │  HTTPS  POST /api/v1/mediciones  |  POST /api/v1/dispositivos/:id/estado-conexion
        ▼
Backend (Render)  →  motor de reglas  →  alertas / notificaciones
        ▼
Frontend (Vercel)  →  bandeja de alertas, monitoreo, histórico
```

---

## Decisión de contrato BLE — **usar Heart Rate Service estándar**

El hub ya scanea `0x180D` y parsea la característica `0x2A37` (HR Measurement)
en formato estándar. Si el simulador emite **HRS estándar**, el hub **no
necesita ningún cambio de protocolo** y el path es idéntico al de la banda
real / Garmin.

| | HRS estándar (recomendado) | Servicio SafePlace propio (`7f8a…`) |
|---|---|---|
| Cambios en el hub | **ninguno** | descubrimiento + parser + normalización nuevos |
| Actividad explícita en el payload | no (la deriva el proxy del hub, ADR-14) | sí (`activityLevel` / `movementScore`) |
| "El hub no sabe si es real o simulador" | ✅ | ✗ (necesita rama de código) |

**Nivel de actividad** con HRS estándar: para el caso que lo necesita
(CP-E2E-03 sobreesfuerzo), correr el hub con `ACTIVITY_MODE=fixed` y
`ACTIVITY_FIXED_VALUE=0.9` durante ese escenario. Para el resto,
`ACTIVITY_MODE=hr-proxy` (default) alcanza.

---

## Cómo correr cada caso (con el simulador Mac)

En la Pi, `~/safeplace-gateway/.env` → setear `FORCE_DEVICE_ID` según el caso y
`sudo systemctl restart safeplace-gateway`. En la Mac, `swift build -c release`
una vez y después:

| CP | `.env` de la Pi | Comando en la Mac | Verificar |
|---|---|---|---|
| 01 | `FORCE_DEVICE_ID=8` | `SafePlaceSim --scenario ../shared/scenarios/normal.json` | Monitoreo: Julio Cesar con FC, sin alerta |
| 02 | `FORCE_DEVICE_ID=8` | `--scenario ../shared/scenarios/fatigue.json` (~13 min) | Alertas Activas: FATIGA (Media) + notif |
| 03 | `FORCE_DEVICE_ID=8` + `ACTIVITY_MODE=fixed` + `ACTIVITY_FIXED_VALUE=0.9` | `--scenario ../shared/scenarios/overexertion.json` | Alertas Activas: SOBREESFUERZO (Crítica) |
| 04 | `FORCE_DEVICE_ID=8` | `--scenario ../shared/scenarios/inactivity.json` | ~15 min después: INACTIVIDAD_PROLONGADA |
| 06 | `FORCE_DEVICE_ID=8` | `normal.json` + cortar la red de la Pi ~1 min y restablecer | cola SQLite crece y luego `flush`, sin duplicados |
| 07 | `FORCE_DEVICE_ID=9` | `--scenario ../shared/scenarios/normal.json` | 400 `DISPOSITIVO_INVALIDO` en el log del hub + `log_auditoria` |
| 08 | `FORCE_DEVICE_ID=10` | `--scenario ../shared/scenarios/normal.json` | 403 en el log del hub; nada en `medicion` |

## 1. Ya construido

### Backend (`services/backend-api`)
- **CP-E2E-04 completo**: migraciones `20260801000001..3` (aplicadas en Neon),
  `inactividadProlongada.service` (chequeo cada 60 s en `server.js`),
  `alertas.service` (creación centralizada), `motorReglas` sin `evaluarInactividad`,
  endpoints `GET/PUT /trabajadores/:id/horario`, `PUT /umbrales` extendido
  (`minutosDesconexionTolerada`), repos con `COALESCE(id_seudonimo)`, cierre
  automático al reconectar.
- **Detección de "wearable congelado"**: `estadoDispositivo.chequearLecturasTrabadas`
  + `historialEstadoDispositivo.listarDispositivosTrabados`.
- **Tests**: `tests/integration/inactividadProlongada.test.js` (5),
  `tests/services/inactividadProlongada.service.test.js` (7),
  `tests/repositories/historialEstadoDispositivo.repository.test.js` (+stuck),
  `motorReglas.service.test.js` reescrito. Todo verde contra branch de Neon.
- **Cobertura ya existente** de otros CP (ver `docs/e2e/README.md`):
  - CP-E2E-01 → `mediciones.ingesta.test.js` ("paquete válido: 201…")
  - CP-E2E-02 → `motorReglas.ingesta.test.js` ("H0010 fatiga…")
  - CP-E2E-03 → `motorReglas.ingesta.test.js` ("H0011 sobreesfuerzo…")
  - CP-E2E-07 → `mediciones.ingesta.test.js` ("wearable sin trabajador asignado…")
  - CP-E2E-08 → `mediciones.ingesta.test.js` ("consentimiento revocado / inexistente…")
- **Docs**: `docs/e2e/README.md` (matriz), `docs/e2e/CP-E2E-04.md`,
  `docs/adr/ADR-13-14-inactividad-y-actividad.md`.

### Hub (`safeplace-hub`)
- `activity.py` — proxy `nivelActividad` (modos `hr-proxy` / `fixed` / `off`).
- `hr_store.py` — `HeartRateStore` + `BackendFlusher` extraídos (sin deps de
  BLE/red → testeables). Sender inyectable.
- `ble_gateway.py` — envía `nivelActividad`, columna `actividad` en SQLite,
  detección de pulso congelado (`STUCK_READINGS_THRESHOLD`), logging y
  creación de directorios robustos.
- `tools/inject_measurements.py` — inyector HTTP libre.
- `tools/scenario_player.py` — escenarios con nombre (`normal`, `fatiga`,
  `sobreesfuerzo`, `no-asociado`, `sin-consentimiento`, `invalida`) contra el
  endpoint real. **Sin BLE** — cubre la parte hub→backend→frontend.
- **Tests**: `tests/test_activity.py` (7), `tests/test_resiliencia.py` (5 —
  **CP-E2E-06**: cola local, reenvío tras caída, sin duplicados, persistencia).
  12/12 verdes.

### Frontend (`apps/web`)
- `Seguridad-Umbrales` — campo "desconexión tolerada en horario (min)".
- `Admin-HorariosOperarios.html/.js` — editor de horario semanal por operario.

### Datos en prod (Neon)
- Migraciones aplicadas + fila `umbral_riesgo` default.
- Operario **Julio Cesar** (id 13) + dispositivo id 8 (MAC `E6:86:92:14:A3:38`)
  + consentimiento + 7 ventanas de horario.

---

## 2. Estado del desarrollo

### A. Simulador BLE (Mac) — **construido** (`tools/ble-simulator/`)

- ✅ App Swift + CoreBluetooth como BLE Peripheral (`macos/`, SwiftPM ejecutable).
  Advertising `0x180D`, característica `0x2A37` Notify (`[0x00, bpm]`).
- ✅ Motor de escenarios (`shared/scenarios/*.json`): `normal`, `fatigue`,
  `overexertion`, `inactivity`, `connection-loss`, `invalid`.
- ✅ Acciones `disconnect` / `reconnect` (para inactividad y pérdida de conexión).
- ✅ Contrato documentado (`docs/ble-contract.md`).
- ⬜ **Falta**: compilarlo y probarlo en la Mac (`swift build -c release`;
  autorizar Bluetooth para la Terminal la primera vez).
- ⬜ App Windows C#/WinUI — pendiente (mismo `0x180D`/`0x2A37`, reusa los JSON).

### B. Hub — **construido**

- ✅ `FORCE_DEVICE_ID` (env): saltea el lookup por MAC — necesario porque la
  dirección BLE de la Mac no es una MAC fija registrable.
- ✅ `activity.py` (proxy `hr-proxy` / `fixed` / `off`), `hr_store.py`, detección
  de pulso congelado.
- ⬜ **Falta**: subir el código nuevo a la Pi. `~/safeplace-gateway/` **no es
  repo git** (archivos escritos a mano por `setup_gateway.sh`). Opciones:
  - `scp ble_gateway.py activity.py hr_store.py bautista@rpsf2.local:~/safeplace-gateway/`
  - o `git clone` el repo del hub en la Pi y apuntar el `ExecStart` del systemd ahí.
- ⬜ Setear en el `.env` de la Pi: `FORCE_DEVICE_ID` según el caso.

### C. Backend — **listo**, nada bloqueante

- CP-E2E-01..08 cubiertos por tests automatizados (ver `README.md`).
- Datos de prueba en prod creados (sección D).
- Migraciones aplicadas en Neon.

### D. Datos de prueba en prod (Neon) — **ya creados**

| Para | Estado |
|---|---|
| CP-E2E-01/02/03/04 | operario **Julio Cesar (id 13)** + **dispositivo 8** + consentimiento + horario 24/7 → `FORCE_DEVICE_ID=8` |
| CP-E2E-07 | **dispositivo 9** (`sim / e2e-07-sin-asignacion`), sin asignación → `FORCE_DEVICE_ID=9` |
| CP-E2E-08 | operario **id 14** ("Sin Consentimiento", consentimiento=false) + **dispositivo 10** asignado → `FORCE_DEVICE_ID=10` |
| CP-E2E-02/03 | `umbral_riesgo` vigente: fatiga 130 bpm / 10 min · sobreesfuerzo 160 bpm + 0.7 · inactividad 15 min · desconexión tolerada 10 min. Para acortar la demo de fatiga, bajar `minutos_fatiga` desde *Seguridad → Umbrales*. |

### E. Frontend — pulido para demo (opcional)

- Label `INACTIVIDAD_PROLONGADA` → "Inactividad prolongada · wearable desconectado".
- Fix del glitch `DISPOSITIVOS /span>` en el tile de Monitoreo.
- Link a `Admin-HorariosOperarios.html` en el nav de las pantallas de admin.

---

## 3. Estado por caso

| CP | Backend | Hub | Simulador | Falta para correrlo |
|---|---|---|---|---|
| **01** normal sin alerta | ✅ testeado | ✅ | ✅ `normal.json` | subir hub a la Pi + compilar sim |
| **02** fatiga | ✅ testeado | ✅ | ✅ `fatigue.json` | idem |
| **03** sobreesfuerzo | ✅ testeado | ✅ (`ACTIVITY_MODE=fixed 0.9`) | ✅ `overexertion.json` | idem |
| **04** inactividad prolongada | ✅ **ya probado en prod** | ✅ | ✅ `inactivity.json` | idem |
| **06** error de transmisión + reenvío | ✅ (409 dedup) | ✅ **testeado** (`test_resiliencia.py`) | ✅ + corte manual de red | idem |
| **07** wearable no asociado | ✅ testeado | ✅ (`FORCE_DEVICE_ID=9`) | ✅ `normal.json` | idem |
| **08** sin consentimiento | ✅ testeado | ✅ (`FORCE_DEVICE_ID=10`) | ✅ `normal.json` | idem |

**Único bloqueante restante**: (1) `swift build` del simulador en la Mac y autorizar Bluetooth para la Terminal; (2) subir `ble_gateway.py` + `activity.py` + `hr_store.py` a la Pi y setear `FORCE_DEVICE_ID` en su `.env`.
