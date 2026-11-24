const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const { createUser, authHeader } = require('./helpers');

describe('Global channel', () => {
  it('puts a new sign-up into the one global channel', async () => {
    const res = await request(app).post('/auth/signup').send({
      username: 'globe_01',
      email: 'globe@example.com',
      password: 'password123',
      displayName: 'Globe',
    });
    expect(res.status).toBe(201);

    const memberships = await prisma.member.findMany({
      where: { userId: res.body.user.id, conversation: { isGlobal: true } },
    });
    expect(memberships).toHaveLength(1);
  });

  it('gives a visitor the global channel too', async () => {
    const res = await request(app).post('/auth/guest');
    expect(res.status).toBe(201);

    const memberships = await prisma.member.findMany({
      where: { userId: res.body.user.id, conversation: { isGlobal: true } },
    });
    expect(memberships).toHaveLength(1);
  });

  it('shows one global channel, first in the list, and never duplicates it', async () => {
    const { token } = await createUser();
    await request(app).get('/conversations').set(authHeader(token));
    const res = await request(app).get('/conversations').set(authHeader(token));

    expect(res.status).toBe(200);
    const globals = res.body.conversations.filter((c) => c.isGlobal);
    expect(globals).toHaveLength(1);
    expect(res.body.conversations[0].isGlobal).toBe(true);
  });
});
