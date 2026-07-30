/* eslint-disable camelcase */

exports.shorthands = undefined;

/**
 * Esquema base mínimo para desarrollo/test local (H0022).
 *
 * El repo nunca tuvo una migración que creara el esquema base: las tablas
 * del DER v1.1 existen sólo en la base de Neon de producción, creadas fuera
 * de node-pg-migrate (no hay `pgmigrations` en Neon). Esta migración replica
 * exactamente esas 8 tablas (columnas/tipos confirmados contra Neon) para
 * que `docker compose up -d postgres` + migraciones alcance para desarrollar
 * y correr tests localmente. No incluye el resto del DER (medicion, alerta,
 * notificacion, etc. — pertenecen a otras épicas y no las toca esta historia).
 *
 * Nota: el nombre real de la tabla de trabajadores es `operario` (no
 * `trabajador`, a pesar de que la migración de registro_consentimiento y sus
 * comentarios usan ese término — quedó desactualizada de un rename previo).
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('empresa', {
    id: { type: 'serial', primaryKey: true },
    nombre: { type: 'varchar(40)', notNull: true },
    cuit: { type: 'varchar(11)', notNull: true, unique: true },
    direccion: { type: 'varchar(40)' },
  });

  pgm.createTable('rol', {
    id: { type: 'serial', primaryKey: true },
    nombre: { type: 'varchar(40)', notNull: true, unique: true },
    descripcion: { type: 'text' },
  });

  // Roles fijos de la aplicación (coinciden con los usados por authorize()
  // en las rutas y con los datos reales de Neon).
  pgm.sql(`
    INSERT INTO rol (nombre, descripcion) VALUES
      ('admin', 'Administrador del sistema'),
      ('supervisor', 'Supervisor operativo'),
      ('seguridad', 'Área de Seguridad e Higiene');
  `);

  pgm.createTable('usuario', {
    id: { type: 'serial', primaryKey: true },
    id_empresa: {
      type: 'integer',
      notNull: true,
      references: 'empresa',
      onDelete: 'RESTRICT',
    },
    nombre: { type: 'varchar(40)', notNull: true },
    apellido: { type: 'varchar(40)', notNull: true },
    email: { type: 'varchar(40)', notNull: true, unique: true },
    password_hash: { type: 'varchar(60)', notNull: true },
    activo: { type: 'boolean', notNull: true, default: true },
  });
  pgm.createIndex('usuario', 'email');
  pgm.createIndex('usuario', 'id_empresa');

  pgm.createTable('usuario_rol', {
    id_usuario: {
      type: 'integer',
      notNull: true,
      references: 'usuario',
      onDelete: 'CASCADE',
    },
    id_rol: {
      type: 'integer',
      notNull: true,
      references: 'rol',
      onDelete: 'CASCADE',
    },
  });
  pgm.addConstraint('usuario_rol', 'usuario_rol_pkey', {
    primaryKey: ['id_usuario', 'id_rol'],
  });

  // Tabla de trabajadores: nombre real `operario` (ver nota arriba).
  pgm.createTable('operario', {
    id: { type: 'serial', primaryKey: true },
    id_empresa: {
      type: 'integer',
      notNull: true,
      references: 'empresa',
      onDelete: 'RESTRICT',
    },
    legajo: { type: 'varchar(15)', notNull: true },
    nombre: { type: 'varchar(40)', notNull: true },
    apellido: { type: 'varchar(40)', notNull: true },
    area: { type: 'text' },
    estado: { type: 'boolean' },
    alta: { type: 'date' },
  });
  pgm.addConstraint('operario', 'operario_empresa_legajo_unique', {
    unique: ['id_empresa', 'legajo'],
  });
  pgm.createIndex('operario', 'id_empresa');

  pgm.createTable('dispositivo', {
    id: { type: 'serial', primaryKey: true },
    marca: { type: 'varchar(40)', notNull: true },
    modelo: { type: 'varchar(40)', notNull: true },
    estado: { type: 'boolean', notNull: true, default: true },
  });

  pgm.createTable('asignacion_dispositivo', {
    id: { type: 'serial', primaryKey: true },
    id_trabajador: {
      type: 'integer',
      notNull: true,
      references: 'operario',
      onDelete: 'CASCADE',
    },
    id_dispositivo: {
      type: 'integer',
      notNull: true,
      references: 'dispositivo',
      onDelete: 'CASCADE',
    },
    fecha_desde: { type: 'timestamptz', notNull: true },
    fecha_hasta: { type: 'timestamptz' },
  });
  pgm.createIndex('asignacion_dispositivo', 'id_dispositivo');
  pgm.createIndex('asignacion_dispositivo', 'id_trabajador');

  pgm.createTable('log_auditoria', {
    id: { type: 'serial', primaryKey: true },
    id_usuario: {
      type: 'integer',
      references: 'usuario',
      onDelete: 'SET NULL',
    },
    tabla_afectada: { type: 'varchar(40)', notNull: true },
    id_registro: { type: 'integer' },
    operacion: { type: 'varchar(20)', notNull: true },
    ip_origen: { type: 'varchar(40)' },
    fecha_hora: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    detalle: { type: 'text' },
  });
  pgm.createIndex('log_auditoria', 'fecha_hora');
  pgm.createIndex('log_auditoria', 'id_usuario');
};

exports.down = (pgm) => {
  pgm.dropTable('log_auditoria');
  pgm.dropTable('asignacion_dispositivo');
  pgm.dropTable('dispositivo');
  pgm.dropTable('operario');
  pgm.dropTable('usuario_rol');
  pgm.dropTable('usuario');
  pgm.dropTable('rol');
  pgm.dropTable('empresa');
};
