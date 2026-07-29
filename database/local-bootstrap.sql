BEGIN;

CREATE TABLE IF NOT EXISTS empresa (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS rol (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  rol VARCHAR(100),
  codigo VARCHAR(100),
  slug VARCHAR(100),
  name VARCHAR(100),
  tipo VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS usuario (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  id_empresa INTEGER NOT NULL REFERENCES empresa(id) ON DELETE RESTRICT,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS usuario_rol (
  id_usuario INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  id_rol INTEGER NOT NULL REFERENCES rol(id) ON DELETE RESTRICT,
  PRIMARY KEY (id_usuario, id_rol)
);

INSERT INTO empresa (nombre)
VALUES ('SafePlace')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO rol (nombre, rol, codigo, slug, name, tipo)
VALUES
  ('Administrador', 'admin', 'admin', 'admin', 'admin', 'admin'),
  ('Supervisor', 'supervisor', 'supervisor', 'supervisor', 'supervisor', 'supervisor'),
  ('Seguridad', 'seguridad', 'seguridad', 'seguridad', 'seguridad', 'seguridad')
ON CONFLICT (nombre) DO NOTHING;

COMMIT;
