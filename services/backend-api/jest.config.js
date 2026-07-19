module.exports = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/globalSetup.js',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 20000,
  // Los tests comparten una única base de datos de test (TEST_DATABASE_URL) y
  // cada archivo trunca las tablas que usa: deben correr en serie para no pisarse.
  maxWorkers: 1,
};
