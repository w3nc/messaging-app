// Unit tests need no database. Integration tests use the test_ database.
// globalSetup runs once before the whole suite and applies migrations to the test database.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  setupFiles: ['<rootDir>/tests/loadEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupAfterEnv.js'],
};
