# SafePlace - Gateway BLE

Servicio en Node.js diseñado para ejecutarse en una Raspberry Pi.

## Responsabilidades

- Descubrir y conectar con wearables Garmin vía BLE (Heart Rate Service).
- Leer datos biométricos y empaquetarlos en JSON.
- Enviar mediciones al Backend API vía HTTPS.
- Manejar cola local y reintentos en caso de fallos de red.
