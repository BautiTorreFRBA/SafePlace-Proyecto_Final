# Simulador de carga SafePlace (Windows / Linux / Mac)

Simula **N wearables simultáneos** enviando mediciones directamente al backend
por HTTP. No requiere BLE ni Raspberry Pi — es ideal para pruebas de carga,
demos y desarrollo en cualquier PC.

## Requisitos

- **Node.js 18 o superior** (usa `fetch` nativo y módulos built-in, sin `npm install`).
- Variable de entorno `GATEWAY_API_KEY` con la clave del backend.

Verificá tu versión: `node --version`

## Uso rápido (PowerShell)

```powershell
# Desde la raíz del repo SafePlace-Proyecto_Final:
$env:GATEWAY_API_KEY = "SP_Gateway_Secure_Key_RaspberryPi_2026"
node tools/load-simulator/simulador-carga.mjs
```

Por defecto lanza **150 dispositivos** con intervalo de **5 s** contra
`https://safeplace-backend-9vhx.onrender.com`.

Cortalo con **Ctrl+C** — marca todos los dispositivos como DESCONECTADO antes de salir.

## Opciones

| Flag | Default | Descripción |
|---|---|---|
| `--cantidad N` | 150 | Cantidad de dispositivos a simular |
| `--intervalo S` | 5 | Segundos entre mediciones por dispositivo |
| `--duracion S` | 0 (infinito) | Segundos totales de corrida |
| `--url URL` | backend de producción | URL base del backend |
| `--pct-fatiga N` | 10 | % de dispositivos con perfil FATIGA (~150 BPM) |
| `--pct-sobreesfuerzo N` | 5 | % con perfil SOBREESFUERZO (~185 BPM + actividad 1.0) |
| `--pct-inactividad N` | 5 | % que emiten 30 s y se desconectan |
| `--dry-run` | — | Valida la configuración sin enviar nada |

## Ejemplos

```powershell
# Demo con 50 dispositivos, más alertas visibles:
node tools/load-simulator/simulador-carga.mjs --cantidad 50 --pct-fatiga 20 --pct-sobreesfuerzo 10

# Prueba rápida de 1 minuto:
node tools/load-simulator/simulador-carga.mjs --duracion 60

# Apuntando a backend local:
node tools/load-simulator/simulador-carga.mjs --url http://localhost:3000

# Solo verificar configuración:
node tools/load-simulator/simulador-carga.mjs --dry-run
```

## Perfiles de medición

| Perfil | FC | Actividad | Alerta esperada |
|---|---|---|---|
| `normal` | 68–92 BPM con variación suave | derivada de FC | Ninguna |
| `fatiga` | ~150 BPM sostenida | derivada de FC | FATIGA (Media) |
| `sobreesfuerzo` | ~185 BPM | 1.0 (fijo) | SOBREESFUERZO (Crítica) |
| `inactividad` | normal 30 s → desconexión | — | INACTIVIDAD_PROLONGADA (~15 min después) |

Los perfiles se asignan al azar al inicio de cada corrida y son fijos durante ella.

## Cómo funciona

El simulador replica exactamente el flujo del hub (ble_gateway.py):

1. `GET /api/v1/dispositivos/lookup?mac=02:5E:ED:00:00:NN` → resuelve MAC a id de dispositivo.
2. `POST /api/v1/dispositivos/:id/estado-conexion` → marca `CONECTADO`.
3. `POST /api/v1/mediciones` cada `--intervalo` segundos con `{ idDispositivo, timestamp, frecuenciaCardiaca, nivelActividad }`.
4. Al detener: marca todos `DESCONECTADO`.

Los dispositivos simulados tienen MAC `02:5E:ED:00:00:01` … `02:5E:ED:00:00:96`
(SafePlace Sim Carga-01 … Carga-150), que deben estar registrados en la base y
con operarios asignados para que las mediciones se procesen.

## Nota de seguridad

La `GATEWAY_API_KEY` va **solo por variable de entorno**, nunca en el código ni en archivos commiteados.
