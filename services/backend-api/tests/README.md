# Tests de integración — capa de acceso a datos

Suite de tests de integración (Jest) para los repositorios de `src/repositories/`. Corren contra una base PostgreSQL real (no mocks de `pg`), con datos de entrada mockeados (`tests/fixtures/mockEntities.js`) que simulan los payloads que llegarían de la app, para verificar que cada entidad se persiste y se puede recuperar correctamente.

## Requisitos

Una base de datos de test dedicada (nunca la de desarrollo/producción, porque los tests truncan tablas). Con el `docker-compose` del repo:

```bash
docker-compose up -d postgres
docker exec safeplace-postgres psql -U safeplace_user -d postgres -c "CREATE DATABASE safeplace_test;"

export TEST_DATABASE_URL="postgresql://safeplace_user:safeplace_password@localhost:5432/safeplace_test"
```

## Correr la suite

```bash
cd services/backend-api
npm test
```

`jest.config.js` corre un `globalSetup` que aplica las migraciones reales de `database/migrations` contra `TEST_DATABASE_URL` antes de la suite, así que no hace falta migrar a mano.

## Cómo están organizados los tests

Un archivo por grupo de entidades del DER (mismo agrupamiento que las migraciones), en `tests/repositories/`:

| Archivo | Entidades |
|---|---|
| `lookup.repository.test.js` | `rol`, `tipo_alerta` |
| `empresaUsuario.repository.test.js` | `empresa`, `usuario`, `usuario_rol` |
| `trabajadorDispositivo.repository.test.js` | `trabajador`, `dispositivo`, `asignacion_dispositivo`, `historial_estado_dispositivo` |
| `medicion.repository.test.js` | `medicion` (incluye `temperatura_corporal`/`spo2`) |
| `alertas.repository.test.js` | `regla_alerta`, `alerta`, `alerta_historial_estado`, `intervencion`, `notificacion` |
| `logAuditoria.repository.test.js` | `log_auditoria` |

Cada `beforeEach` trunca las tablas relevantes (`tests/helpers/testDb.js`) para que cada test arranque de una base limpia. Por eso `jest.config.js` fuerza `maxWorkers: 1`: todos los archivos comparten la misma base de test y deben correr en serie.
