# Modelo de Datos — SafePlace

Implementación en PostgreSQL (Neon) del DER v1.1 ("Diagrama de Entidad Relación (DER)", 25/06/26). Las migraciones ejecutables están en [`database/migrations`](../../database/migrations).

## Entidades y relaciones

| Entidad | Relación principal |
|---|---|
| `rol` | N:M con `usuario` vía `usuario_rol` |
| `usuario_rol` | PK compuesta (`id_usuario`, `id_rol`) |
| `empresa` | 1:N con `usuario` y `trabajador` |
| `usuario` | N:1 `empresa`; origen de `alerta_historial_estado`, `intervencion`, `notificacion`, `log_auditoria` |
| `trabajador` | N:1 `empresa`; 1:N `medicion`, `alerta`; N:M `dispositivo` vía `asignacion_dispositivo` |
| `dispositivo` | N:M `trabajador` vía `asignacion_dispositivo`; 1:N `historial_estado_dispositivo`, `medicion` |
| `asignacion_dispositivo` | vincula `trabajador` y `dispositivo` con vigencia (`fecha_desde`/`fecha_hasta`) |
| `historial_estado_dispositivo` | N:1 `dispositivo` |
| `medicion` | N:1 `trabajador`, N:1 `dispositivo`; origen de `alerta` |
| `tipo_alerta` | 1:N `regla_alerta`, `alerta` |
| `regla_alerta` | N:1 `tipo_alerta` (umbrales) |
| `alerta` | N:1 `tipo_alerta`, `trabajador`; N:0..1 `medicion`; 1:N `alerta_historial_estado`, `intervencion`, `notificacion` |
| `alerta_historial_estado` | N:1 `alerta` (auditoría de cambios de estado) |
| `intervencion` | N:1 `alerta`, `usuario` (acción tomada) |
| `notificacion` | N:1 `alerta`, `usuario` (envío de alerta) |
| `log_auditoria` | N:0..1 `usuario` (auditoría de accesos a datos sensibles) |

## Desviaciones respecto al DER literal

1. **`usuario.password_hash`: `VARCHAR(40)` → `VARCHAR(60)`.** El DER especifica 40 caracteres, pero un hash bcrypt real ocupa 60. Se amplió para que el login funcione sin truncar el hash.
2. **`DATETIME` → `TIMESTAMPTZ`.** PostgreSQL no tiene el tipo `DATETIME` (es de MySQL/SQL Server); se usa `TIMESTAMPTZ` para todas las columnas de fecha/hora del DER, evitando ambigüedad de zona horaria en un despliegue cloud.
3. **`medicion` extendida con `temperatura_corporal` y `spo2` (ambas `NUMERIC`, nullable).** No están en el DER v1.1, pero el prototipo de frontend (`apps/web/Supervisor-Mediciones.js`) ya las muestra en la tabla de historial de mediciones. Se agregaron como nullable porque el wearable puede no reportarlas siempre. Ningún otro campo esperado por el frontend (telemetría BLE en `dispositivo`, `departamento`/fecha de alta en `trabajador`) se agregó en esta V1: quedan pendientes para una revisión futura del DER.

## Índices

Sobre columnas de búsqueda frecuente, según la sección 9 (Performance) del Documento de Arquitectura: `medicion(id_trabajador)`, `medicion(fecha_hora)`, `alerta(id_trabajador)`, `alerta(estado)`, `alerta(id_tipo_alerta)`, `trabajador(id_empresa)`, `usuario(id_empresa)`, `usuario(email)`, `log_auditoria(fecha_hora)`.

## Referencia visual

El diagrama original entregado por la cátedra está en `1.4 Diagrama de Entidad Relación (DER) - UTN - 2026.docx` (no versionado en este repo).
