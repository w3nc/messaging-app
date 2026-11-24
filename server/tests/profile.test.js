const request = require('supertest');
const app = require('../src/app');
const { createUser, authHeader } = require('./helpers');

describe('PATCH /me', () => {
  it('updates displayName, title, bio and avatarColor', async () => {
    const { token } = await createUser();
    const res = await request(app).patch('/me').set(authHeader(token)).send({
      displayName: 'New Name',
      title: 'Designer',
      bio: 'Hello there',
      avatarColor: '#ff8800',
    });

    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe('New Name');
    expect(res.body.user.title).toBe('Designer');
    expect(res.body.user.bio).toBe('Hello there');
    expect(res.body.user.avatarColor).toBe('#ff8800');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 400 for invalid input', async () => {
    const { token } = await createUser();
    const res = await request(app).patch('/me').set(authHeader(token)).send({
      displayName: '',
      avatarColor: 'red',
    });

    expect(res.status).toBe(400);
    expect(res.body.details.displayName).toBeDefined();
    expect(res.body.details.avatarColor).toBeDefined();
  });

  it('returns 409 when the username is taken', async () => {
    await createUser({ username: 'taken_one' });
    const { token } = await createUser({ username: 'mine_one' });
    const res = await request(app).patch('/me').set(authHeader(token)).send({ username: 'taken_one' });

    expect(res.status).toBe(409);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).patch('/me').send({ title: 'Nope' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /users/:id', () => {
  it("returns 403 when editing someone else's profile", async () => {
    const { user: other } = await createUser();
    const { token } = await createUser();
    const res = await request(app)
      .patch(`/users/${other.id}`)
      .set(authHeader(token))
      .send({ bio: 'Hacked' });

    expect(res.status).toBe(403);
  });
});
