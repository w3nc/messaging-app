// Runs once before the suite. Loads .env, checks the test database name, then applies migrations to it.
const path = require('path');
const { execSync } = require('child_process');

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  require('../src/config/env');

  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is missing. Add it to server/.env');

  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.startsWith('test_')) {
    throw new Error(`Refusing to run: "${dbName}" is not a test_ database`);
  }

  execSync('npx prisma migrate deploy', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
};
