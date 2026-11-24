// Runs before each test file. Empties the test tables before every test, then closes the connection.
const prisma = require('../src/lib/prisma');
const { resetDatabase } = require('./helpers');

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
