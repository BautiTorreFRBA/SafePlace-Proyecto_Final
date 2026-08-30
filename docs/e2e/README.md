# Casos de prueba E2E — trazabilidad

Cada CP-E2E se puede validar de tres formas, en orden de preferencia:

1. **Test automatizado** (`services/backend-api/tests/` o `safeplace-hub/tests/`) — corre en CI, no necesita hardware.
2. **Reproductor de escenarios** (`safeplace-hub/tools/scenario_player.py`) — postea al backend real por el endpoint real (`POST /api/v1/mediciones`), sin BLE ni tocar la DB. Para demos y verificación manual del flujo completo hasta el frontend.
3. **Wearable físico** — la banda pectoral / Garmin real contra la Raspberry Pi.

> El reproductor y los tests **nunca** insertan en la base ni generan alertas a mano: todo pasa por el procesamiento normal de mediciones (restricción del plan de testing).

## Matriz

| CP | Qué valida | Test automatizado | Escenario / manual |
|---|---|---|---|
| **CP-E2E-01** | Medición válida recorre el circuito, se almacena, **sin alerta** | `tests/integration/mediciones.ingesta.test.js` ("paquete válido: 201…", "H0020…") | `scenario_player.py --scenario normal` |
| **CP-E2E-02** | Fatiga: FC sostenida > umbral → alerta **Media** | `tests/integration/motorReglas.ingesta.test.js` ("H0010 fatiga: FC sostenida…") + `tests/services/motorReglas.service.test.js` | `scenario_player.py --scenario fatiga --fc 150 --window-minutes 12` |
| **CP-E2E-03** | Sobreesfuerzo: FC alta + actividad alta → alerta **Crítica** + notificación | `tests/integration/motorReglas.ingesta.test.js` ("H0011 sobreesfuerzo…") | `scenario_player.py --scenario sobreesfuerzo --fc 185 --actividad 0.9` |
| **CP-E2E-04** | Inactividad prolongada = wearable desconectado en horario laboral > tolerancia | `tests/integration/inactividadProlongada.test.js` (5 casos) + `tests/services/inactividadProlongada.service.test.js` | ver [`CP-E2E-04.md`](CP-E2E-04.md) |
| **CP-E2E-06** | Fallo de conectividad gateway↔backend: cola local + reenvío, sin duplicados | `safeplace-hub/tests/test_resiliencia.py` (5 casos) | ver "Manual" abajo |
| **CP-E2E-07** | Rechazo de medición de wearable no asociado a operario activo | `tests/integration/mediciones.ingesta.test.js` ("wearable sin trabajador asignado: 400…") | `scenario_player.py --scenario no-asociado --device-id <sin asignar>` |
| **CP-E2E-08** | Rechazo de almacenamiento por consentimiento no otorgado / revocado | `tests/integration/mediciones.ingesta.test.js` ("consentimiento revocado: 403…", "consentimiento inexistente…") | `scenario_player.py --scenario sin-consentimiento --device-id <sin consent.>` |
| — | Paquetes inválidos / incompletos / corruptos (RF-04 / H0008) | `tests/integration/mediciones.ingesta.test.js` (campos incompletos, fuera de rango, tipos, JSON corrupto, duplicado) | `scenario_player.py --scenario invalida` |

## Correr los tests automatizados

**Backend** (necesita `TEST_DATABASE_URL` a un branch de Neon — ver `services/backend-api/tests/README.md`):
```bash
cd services/backend-api && npx jest
```

**Hub** (sin dependencias externas):
```bash
cd safeplace-hub && pip install -r requirements-dev.txt && pytest -q
```

## Reproductor de escenarios

```bash
cd safeplace-hub
export BACKEND_URL=https://safeplace-backend-9vhx.onrender.com
export API_KEY=<GATEWAY_API_KEY de Render>

python tools/scenario_player.py --scenario fatiga --device-id 8 \
  --backend-url "$BACKEND_URL" --api-key "$API_KEY"
```
Precondiciones de estado (operario activo, wearable asociado, consentimiento, umbrales, horario) se cargan desde las pantallas de admin o por SQL — el reproductor solo emite mediciones.

## CP-E2E-06 — procedimiento manual

Con el hub corriendo y mandando datos:

1. Cortar la salida del gateway al backend (una de):
   - `sudo iptables -A OUTPUT -p tcp --dport 443 -d <host-backend> -j REJECT`
   - o desconectar la red de la Pi
   - o `BACKEND_URL` a un host inexistente + `systemctl restart`
2. Verificar en el log del gateway: reintentos fallidos, `reading en cola (id=…)`. En la base: no llegan mediciones nuevas.
3. En la Pi: `sqlite3 ~/safeplace-gateway/safeplace.db "SELECT count(*) FROM heart_rate_log WHERE sent=0;"` → crece.
4. Restablecer la conectividad (borrar la regla iptables / reconectar / URL correcta + restart).
5. Verificar: `Backend flush: N readings enviados` en el log; `sent=0` vuelve a 0; las mediciones aparecen en la base **sin duplicados** (el índice único `(id_dispositivo, fecha_hora)` + el 409 del backend lo garantizan).
