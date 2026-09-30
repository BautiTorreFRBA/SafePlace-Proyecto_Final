# Simulador de mediciones sin BLE

## Simulación de carga: 20 operarios, encender y apagar

Para ver cómo se comportan el backend y los dashboards con muchos operarios
conectados a la vez. Hace falta Node >= 18 y la `GATEWAY_API_KEY` del backend
(variable de entorno o `GATEWAY_API_KEY=...` en el `.env` de la raíz del repo,
ignorado por git; nunca se sube).

**Una sola vez (por base de datos):** crear los 20 operarios de prueba
corriendo `sql/sembrar-carga.sql` en el SQL Editor de Neon. Es idempotente.

```bash
cd tools/mediciones-sim
npm run on       # los 20 operarios pasan a CONECTADO y mandan FC cada ~5 s
npm run status   # ¿encendida? últimos resúmenes y problemas
npm run off      # los 20 pasan a DESCONECTADO y se frena todo
```

(sin npm: `node carga.js on|off|status`. Variantes: `npm run on -- --cantidad 5`
usa solo los primeros 5; `npm run dry-run` prueba sin tocar la red.)
Corre en segundo plano; el log queda en `carga.log`.

### Qué crea `sembrar-carga.sql`

20 operarios `SIM-01..SIM-20` (legajo), cada uno con wearable
`02:5E:ED:00:00:NN`, asignación vigente, consentimiento y horario laboral
(lunes a viernes). Los umbrales de FC son el global (`umbral_riesgo`) salvo
los 7 que tienen "Configuración particular".

| Horario | Operarios | Días |
|---|---|---|
| Mañana 06:00–14:00 | SIM-01..07 | L–V |
| Tarde 14:00–22:00 | SIM-08..14 | L–V |
| Noche 20:00–23:59 | SIM-15..18 | L–V |
| Guardia 00:00–23:59 | SIM-19, SIM-20 | L–D |

Áreas: Producción, Logística y Mantenimiento. Tolerancia de desconexión por
puesto (`trabajo`): Línea de producción 3 min, Depósito 4, Mantenimiento 4,
Guardia 2. FC particular (fatiga/sobreesfuerzo): SIM-01 135/165, SIM-02 125/155,
SIM-05 140/170, SIM-08 128/158, SIM-11 138/168, SIM-15 132/162, SIM-18 126/156.
Las 2 guardias garantizan que a cualquier hora haya operarios dentro de
horario. Los turnos nocturnos que cruzan la medianoche no están soportados.

### Qué hace cada operario (`roster.json`)

Casi todos trabajan normal (FC ~84–110, por debajo de sus umbrales). Tres
generan alertas a propósito: **SIM-07** fatiga (FC ~140 sostenida), **SIM-18**
fatiga con su umbral particular (126), **SIM-13** sobreesfuerzo (FC ~172 y
actividad alta). Editá `perfil` en `roster.json` para cambiarlo.
Probar INACTIVIDAD_PROLONGADA: `npm run off` con operarios dentro de horario
y esperar la tolerancia (3–4 min, los de guardia 2): avisa una vez por corte.

### Antes de encender

- Escribe en la **base real** (la del backend en Render). Son operarios de
  prueba, pero las alertas y mediciones quedan en los dashboards.
- El umbral global puede estar en modo prueba (fatiga 1 min, tolerancia 1
  min): con 20 operarios se generan alertas muy rápido. Es esperable.
- No correrlo a la vez que el hub o el simulador BLE sobre los mismos
  dispositivos (no aplica: sus MAC son sintéticas).

### Borrar todo al terminar

`sql/limpiar-carga.sql` elimina los 20 operarios de simulación, sus wearables,
mediciones, alertas y puestos de prueba. No toca operarios reales.

---

## Simulador de dispositivos sueltos

Reemplaza al hub + wearables para probar el backend y los dashboards con **N
dispositivos a la vez**, sin radios Bluetooth. Hace exactamente lo que hace
`ble_gateway.py`:

- `POST /api/v1/mediciones` — una lectura por dispositivo cada `intervalo` s
  (FC + `nivelActividad` aproximando el proxy del hub).
- `POST /api/v1/dispositivos/:id/estado-conexion` — `CONECTADO` al arrancar,
  `DESCONECTADO` al detenerse (Ctrl-C, fin del escenario o acción `disconnect`).
  Es lo que dispara `INACTIVIDAD_PROLONGADA`.

Usa los mismos escenarios que el simulador BLE
(`../ble-simulator/shared/scenarios/*.json`): `normal`, `fatigue`,
`overexertion`, `inactivity`, `connection-loss`, `invalid`.

## Uso

```bash
export GATEWAY_API_KEY=...        # la misma que el .env del hub (no se guarda en el repo)
cd tools/mediciones-sim

# 3 dispositivos normales hasta Ctrl-C
node simular-mediciones.js --devices 1,2,3 --duracion 0

# mezcla de escenarios
node simular-mediciones.js --devices 8,11:fatigue,12:overexertion,13:inactivity

# probar sin red
node simular-mediciones.js --devices 8,11 --dry-run --intervalo 1 --duracion 5
```

Opciones: `--escenario`, `--intervalo`, `--duracion` (0 = hasta Ctrl-C),
`--url`, `--key`, `--sin-estado`, `--dry-run`. `--help` las lista.

En PowerShell: `$env:GATEWAY_API_KEY = "..."`.

## Precondiciones por dispositivo

El backend valida igual que con el hub. Cada `id_dispositivo` tiene que tener:

1. **Asignación vigente** a un operario (Asociar Wearable).
2. **Consentimiento otorgado** de ese operario.

Si falta alguno el script lo informa una vez por dispositivo
(`SIN_ASIGNACION`, `SIN_CONSENTIMIENTO`, 404...) y sigue con los demás.
Para alertas de inactividad además cuenta el horario laboral del operario y la
tolerancia vigente (`umbral_riesgo.minutos_desconexion_tolerada`).

## Ojo

- **Escribe en la base real** del backend. Usarlo solo con operarios de prueba.
- Un mismo dispositivo no puede correr en dos procesos a la vez (duplicaría
  mediciones), ni a la vez que el hub o el simulador BLE.
- `invalid` manda FC 245: el backend la descarta y la audita (es lo esperado).
