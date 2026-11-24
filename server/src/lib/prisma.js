require('../config/env');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString =
  process.env.NODE_ENV === 'test' ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Database URL is missing. Copy server/.env.example to server/.env and fill it in.');
}

// Safety net: tests must never touch the dev or production database.
if (process.env.NODE_ENV === 'test') {
  let dbName = '';
  try {
    dbName = new URL(connectionString).pathname.slice(1);
  } catch {
    dbName = '';
  }
  if (!dbName.startsWith('test_')) {
    throw new Error(`Refusing to run tests against "${dbName}". TEST_DATABASE_URL must name a test_ database.`);
  }
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
