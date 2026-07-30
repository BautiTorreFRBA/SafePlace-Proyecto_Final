let contador = 0;
const siguiente = () => {
  contador += 1;
  return contador;
};

const empresaMock = (overrides = {}) => ({
  nombre: 'Empresa Test',
  cuit: overrides.cuit || `2011111${String(1000 + siguiente()).slice(-4)}`,
  ...overrides,
});

const trabajadorMock = (idEmpresa, overrides = {}) => ({
  idEmpresa,
  legajo: `EMP-${siguiente()}`,
  nombre: 'Nombre',
  apellido: 'Apellido',
  estado: true,
  ...overrides,
});

const dispositivoMock = (overrides = {}) => ({
  marca: 'garmin',
  modelo: 'vivosmart5',
  estado: true,
  ...overrides,
});

const medicionMock = (idTrabajador, idDispositivo, overrides = {}) => ({
  idTrabajador,
  idDispositivo,
  fechaHora: new Date('2026-07-18T12:00:00.000Z'),
  frecuenciaCardiaca: 88,
  actividad: '0.5',
  temperaturaCorporal: 36.6,
  spo2: 98,
  ...overrides,
});

module.exports = {
  empresaMock,
  trabajadorMock,
  dispositivoMock,
  medicionMock,
};
