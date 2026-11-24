const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const { createUser, authHeader } = require('./helpers');

describe('POST /auth/signup', () => {
  it('creates a user, returns 201 and never returns passwordHash', async () => {
    const res = await request(app).post('/auth/signup').send({
      username: 'alice_01',
      email: 'alice@example.com',
      password: 'password123',
      displayName: 'Alice',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const saved = await prisma.user.findUnique({ where: { email: 'alice@example.com' } });
    expect(saved).not.toBeNull();
    expect(saved.passwordHash).not.toBe('password123');
  });

  it('rejects a duplicate email with 409', async () => {
    await createUser({ email: 'dup@example.com', username: 'first_user' });
    const res = await request(app).post('/auth/signup').send({
      username: 'second_user',
      email: 'dup@example.com',
      password: 'password123',
      displayName: 'Second',
    });
    expect(res.status).toBe(409);
    expect(res.body.details.email).toBeDefined();
  });

  it('rejects a duplicate username with 409', async () => {
    await createUser({ email: 'one@example.com', username: 'taken_name' });
    const res = await request(app).post('/auth/signup').send({
      username: 'taken_name',
      email: 'two@example.com',
      password: 'password123',
      displayName: 'Two',
    });
    expect(res.status).toBe(409);
    expect(res.body.details.username).toBeDefined();
  });

  it('rejects invalid input with 400', async () => {
    const res = await request(app).post('/auth/signup').send({
      username: '',
      email: 'not-an-email',
      password: '123',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.details).toBeDefined();
  });
});

describe('POST /auth/login', () => {
  it('returns a token and user for the correct password', async () => {
    const { user } = await createUser({ email: 'bob@example.com', password: 'secret123' });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'bob@example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('sets an httpOnly auth cookie', async () => {
    await createUser({ email: 'cookie@example.com', password: 'secret123' });
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'cookie@example.com', password: 'secret123' });

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('qc_token='));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('returns 401 for a wrong password', async () => {
    await createUser({ email: 'carol@example.com', password: 'secret123' });
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'carol@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Incorrect email or password. Try again.');
  });

  it('returns 401 for an unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'secret123' });
    expect(res.status).toBe(401);
  });
});

describe('GET /me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
  });

  it('returns the signed-in user with a valid token', async () => {
    const { user, token } = await createUser({ displayName: 'Dana' });
    const res = await request(app).get('/me').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.displayName).toBe('Dana');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 401 for a garbage token', async () => {
    const res = await request(app).get('/me').set(authHeader('not-a-real-token'));
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('clears the auth cookie and returns ok', async () => {
    const res = await request(app).post('/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('qc_token='));
    expect(cookie).toMatch(/qc_token=;/);
  });
});

describe('POST /auth/guest', () => {
  it('creates a visitor account and returns 201 with isGuest flag', async () => {
    const res = await request(app).post('/auth/guest');

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.isGuest).toBe(true);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const saved = await prisma.user.findUnique({ where: { id: res.body.user.id } });
    expect(saved).not.toBeNull();
    expect(saved.isGuest).toBe(true);
    expect(saved.username).toMatch(/^visitor_/);
    expect(saved.email).toMatch(/@guest\.quickchat\.local$/);
  });

  it('sets an httpOnly auth cookie', async () => {
    const res = await request(app).post('/auth/guest');

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('qc_token='));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('flags the visitor as a guest on GET /me', async () => {
    const res = await request(app).post('/auth/guest');
    const token = res.body.token;

    const me = await request(app).get('/me').set(authHeader(token));
    expect(me.status).toBe(200);
    expect(me.body.user.isGuest).toBe(true);
  });

  it('rejects profile edits for a visitor with 403', async () => {
    const res = await request(app).post('/auth/guest');
    const token = res.body.token;

    const me = await request(app)
      .patch('/me')
      .set(authHeader(token))
      .send({ displayName: 'Edited' });
    expect(me.status).toBe(403);
    expect(me.body.error).toContain('account');
  });
});
