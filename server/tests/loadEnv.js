// Runs before every test file. Forces the test environment so tests use TEST_DATABASE_URL.
process.env.NODE_ENV = 'test';
require('../src/config/env');
