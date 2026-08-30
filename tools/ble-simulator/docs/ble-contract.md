# Contrato BLE del simulador

El simulador **no** define un servicio propio. Usa el **Bluetooth SIG Heart
Rate Service estándar**, que es lo que el hub (`safeplace-hub/ble_gateway.py`)
ya descubre y parsea, y lo que exponen las bandas pectorales / relojes reales.

## Servicio

| | |
|---|---|
| Heart Rate Service | UUID `0x180D` (`0000180d-0000-1000-8000-00805f9b34fb`) |
| Advertising | incluye el service UUID `0x180D` + `LocalName` (`SafePlace-Sim` por default) |

## Característica

| | |
|---|---|
| Heart Rate Measurement | UUID `0x2A37` (`00002a37-0000-1000-8000-00805f9b34fb`) |
| Propiedades | `Notify` (principal) + `Read` |

### Formato del valor (perfil HRM estándar)

```
byte 0 : flags
         bit 0 = 0  → Heart Rate Value en uint8 (byte 1)
         bit 0 = 1  → Heart Rate Value en uint16 LE (bytes 1-2)
byte 1 : Heart Rate (bpm)         [cuando bit 0 = 0]
```

El simulador emite siempre `flags = 0x00` + bpm en un byte:
`Data([0x00, UInt8(bpm)])`.

El hub (`parse_hr`) ya soporta ambos formatos.

## Nivel de actividad

El HRS estándar **no transporta** nivel de actividad. El hub lo estima con el
proxy derivado de FC (`activity.py`, ADR-14). Para el caso que necesita un
valor de actividad controlado (CP-E2E-03 sobreesfuerzo), se corre el hub con
`ACTIVITY_MODE=fixed` + `ACTIVITY_FIXED_VALUE=0.9`.

## Identificación del dispositivo

La dirección BLE de una Mac/PC es de hardware o aleatoria y rota — no sirve
como MAC fija registrable. Por eso, en modo prueba, el hub usa
`FORCE_DEVICE_ID` (env) en lugar de resolver el dispositivo por MAC contra
`GET /api/v1/dispositivos/lookup`.
