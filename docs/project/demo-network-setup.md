# Configuración de red para la demo

Setup para el día de presentación: Raspberry Pi → cable ethernet → laptop → hotspot celular → internet.

## Diagrama

```
Celular (hotspot)
      │ WiFi
   Laptop
      │ Ethernet (cable RJ-45)
  Raspberry Pi (safeplace-hub)
```

## IPs estáticas

| Dispositivo | Interfaz | IP              |
|-------------|----------|-----------------|
| Laptop      | Ethernet | 192.168.137.1   |
| Raspberry Pi| eth0     | 192.168.137.2   |

La Pi tiene su default route por eth0 (métrica 100), preferido sobre wlan0 (métrica 600).

## Cómo funciona el NAT

La Pi accede a internet a través del laptop usando **Windows WinNAT** (no ICS clásico).
El NAT traduce todo el tráfico de `192.168.137.0/24` hacia la conexión activa del laptop (hotspot).

El NAT se configura una sola vez y persiste entre reinicios (guardado en el registro de Windows).

## Primera vez / restaurar la config

Si el NAT desaparece (por ejemplo, después de un formateo), abrir **PowerShell como Administrador** y ejecutar:

```powershell
New-NetNat -Name "SafePlaceNAT" -InternalIPInterfaceAddressPrefix "192.168.137.0/24"
```

Verificar que está activo:

```powershell
Get-NetNat
```

Debe mostrar `Active : True`.

## ICS (Uso compartido) — también debe estar habilitado

En `ncpa.cpl` → click derecho en **Wi-Fi** → Propiedades → pestaña **Uso compartido**:
- ✅ "Permitir que los usuarios de otras redes se conecten..."
- Conexión de red doméstica: **Ethernet**

Esto asigna automáticamente la IP `192.168.137.1` al adaptador Ethernet del laptop.

## Configuración estática en la Pi (NetworkManager)

La Pi tiene una conexión NetworkManager persistente `eth0-emergency` con:

```
IP:      192.168.137.2/24
Gateway: 192.168.137.1
DNS:     8.8.8.8, 1.1.1.1
```

Para verificar desde la Pi:
```bash
nmcli connection show eth0-emergency
ip addr show eth0
ip route
```

## SSH de emergencia

Si la Pi pierde acceso WiFi, siempre se puede entrar por cable ethernet:

```powershell
# Desde el laptop (Windows), con el cable conectado:
ssh -i ~/.ssh/proyecto safeplace@192.168.137.2
```

La clave SSH está en `~/.ssh/proyecto` en el laptop.

## Verificar conectividad end-to-end

```bash
# Desde el laptop:
ssh -i ~/.ssh/proyecto safeplace@192.168.137.2 "ping -c 3 8.8.8.8"

# Debe responder con 0% packet loss
```

## Orden de arranque para la demo

1. Prender el celular y activar el hotspot
2. Conectar la laptop al hotspot
3. Conectar el cable ethernet entre laptop y Pi
4. Prender la Pi (o conectarla si ya está encendida)
5. La Pi levanta eth0 automáticamente con IP 192.168.137.2
6. El hub BLE (`ble_gateway.py`) corre como servicio y arranca solo

No se necesita ningún comando manual para la demo si todo está pre-configurado.
