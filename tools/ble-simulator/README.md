# Simulador BLE de wearable — SafePlace

Emula un wearable BLE que expone el **Heart Rate Service estándar** (`0x180D`,
característica `0x2A37`), igual que una banda pectoral o un Garmin real. La
Raspberry Pi (hub) lo descubre, se conecta y le envía las mediciones al
backend por su flujo normal — **el hub no necesita ningún cambio de protocolo**.

```
tools/ble-simulator/
├── shared/scenarios/     escenarios de prueba (JSON, compartidos)
├── macos/                app Swift + CoreBluetooth  (implementada)
├── windows/              app C# / WinUI            (pendiente)
└── docs/ble-contract.md  contrato GATT
```

## macOS

Requiere Xcode Command Line Tools (`xcode-select --install`).

```bash
cd tools/ble-simulator/macos
swift build -c release
```

La primera vez, macOS pide permiso de Bluetooth para la Terminal:
**Ajustes → Privacidad y seguridad → Bluetooth → activar Terminal** (o iTerm).

### Correr un escenario

```bash
cd tools/ble-simulator/macos
.build/release/SafePlaceSim --scenario ../shared/scenarios/fatigue.json
```

| Escenario | Caso | Qué hace |
|---|---|---|
| `normal.json` | CP-E2E-01 | FC 70–85, en loop; sin alerta |
| `fatigue.json` | CP-E2E-02 | FC ~150 durante 13 min → alerta FATIGA (Media) |
| `overexertion.json` | CP-E2E-03 | FC ~185 → el proxy da actividad ~1.0 → alerta SOBREESFUERZO (Crítica) |
| `inactivity.json` | CP-E2E-04 | emite 30 s y se **desconecta**; a los ~15 min (en horario laboral) → alerta INACTIVIDAD_PROLONGADA |
| `connection-loss.json` | H0007 | se desconecta a los 40 s y reconecta a los 100 s |
| `invalid.json` | RF-04 / H0008 | FC 245 (fuera de rango) → descartada y auditada |

## Configuración del hub para las pruebas

En `~/safeplace-gateway/.env` de la Raspberry Pi:

```ini
FORCE_DEVICE_ID=8            # id del dispositivo del backend (Julio Cesar)
TARGET_ADDRESSES=            # vacío = auto-scan (encuentra el simulador por HRS)
ACTIVITY_MODE=hr-proxy       # default; sirve para todos los escenarios
```

`FORCE_DEVICE_ID` es necesario porque la dirección BLE de una Mac es de
hardware / aleatoria y no se puede registrar como MAC fija: el hub saltea el
lookup por MAC y usa ese id directamente.

Para CP-E2E-07 / CP-E2E-08 se apunta `FORCE_DEVICE_ID` a un dispositivo sin
asignación vigente / de un operario sin consentimiento (ver
`docs/e2e/plan-simulador-ble.md`).

## Windows

Pendiente. Debe exponer el mismo `0x180D` / `0x2A37` estándar (UWP/WinUI
`GattServiceProvider`). Los JSON de `shared/scenarios/` se reutilizan tal cual.
