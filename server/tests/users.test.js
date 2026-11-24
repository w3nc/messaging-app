const request = require('supertest');
const app = require('../src/app');
const { createUser, authHeader } = require('./helpers');

describe('users and friends', () => {
  it('lists other users but not yourself', async () => {
    const { user: bob } = await createUser();
    const { user: alice, token } = await createUser();

    const res = await request(app).get('/users').set(authHeader(token));
    expect(res.status).toBe(200);
    const ids = res.body.users.map((u) => u.id);
    expect(ids).toContain(bob.id);
    expect(ids).not.toContain(alice.id);
    expect(res.body.users[0].passwordHash).toBeUndefined();
  });

  it('sends a request that waits until the other person accepts', async () => {
    const { user: alice, token: aliceToken } = await createUser();
    const { user: bob, token: bobToken } = await createUser();

    const add = await request(app).post('/friends').set(authHeader(aliceToken)).send({ userId: bob.id });
    expect(add.status).toBe(201);
    expect(add.body.status).toBe('pending');

    // Nobody is a friend yet.
    const aliceFriends = await request(app).get('/friends').set(authHeader(aliceToken));
    expect(aliceFriends.body.friends).toHaveLength(0);

    const bobRequests = await request(app).get('/friends/requests').set(authHeader(bobToken));
    expect(bobRequests.body.incoming.map((u) => u.id)).toEqual([alice.id]);

    const aliceRequests = await request(app).get('/friends/requests').set(authHeader(aliceToken));
    expect(aliceRequests.body.outgoing.map((u) => u.id)).toEqual([bob.id]);
    expect(aliceRequests.body.incoming).toHaveLength(0);
  });

  it('accepts a request so both sides become friends', async () => {
    const { user: alice, token: aliceToken } = await createUser();
    const { user: bob, token: bobToken } = await createUser();

    await request(app).post('/friends').set(authHeader(aliceToken)).send({ userId: bob.id });
    const accept = await request(app).post(`/friends/${alice.id}/accept`).set(authHeader(bobToken));
    expect(accept.status).toBe(200);

    const bobFriends = await request(app).get('/friends').set(authHeader(bobToken));
    expect(bobFriends.body.friends.map((f) => f.id)).toEqual([alice.id]);
    expect(typeof bobFriends.body.friends[0].online).toBe('boolean');

    const aliceFriends = await request(app).get('/friends').set(authHeader(aliceToken));
    expect(aliceFriends.body.friends.map((f) => f.id)).toEqual([bob.id]);

    // The request is gone now that they are friends.
    const waiting = await request(app).get('/friends/requests').set(authHeader(bobToken));
    expect(waiting.body.incoming).toHaveLength(0);
  });

  it('cannot accept a request that was never sent', async () => {
    const { user: alice, token: aliceToken } = await createUser();
    const { token: bobToken } = await createUser();

    const accept = await request(app).post(`/friends/${alice.id}/accept`).set(authHeader(bobToken));
    expect(accept.status).toBe(404);
    expect((await request(app).get('/friends').set(authHeader(bobToken))).body.friends).toHaveLength(0);
  });

  it('accepts automatically when the other person asked first', async () => {
    const { user: alice, token: aliceToken } = await createUser();
    const { user: bob, token: bobToken } = await createUser();

    await request(app).post('/friends').set(authHeader(bobToken)).send({ userId: alice.id });
    const res = await request(app).post('/friends').set(authHeader(aliceToken)).send({ userId: bob.id });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');

    const aliceFriends = await request(app).get('/friends').set(authHeader(aliceToken));
    expect(aliceFriends.body.friends.map((f) => f.id)).toContain(bob.id);
  });

  it('does not duplicate a request or an existing friendship', async () => {
    const { user: alice, token: aliceToken } = await createUser();
    const { user: bob, token: bobToken } = await createUser();

    await request(app).post('/friends').set(authHeader(aliceToken)).send({ userId: bob.id });
    await request(app).post('/friends').set(authHeader(aliceToken)).send({ userId: bob.id });
    const bobRequests = await request(app).get('/friends/requests').set(authHeader(bobToken));
    expect(bobRequests.body.incoming).toHaveLength(1);

    await request(app).post(`/friends/${alice.id}/accept`).set(authHeader(bobToken));
    const again = await request(app).post('/friends').set(authHeader(aliceToken)).send({ userId: bob.id });
    expect(again.body.status).toBe('accepted');
    expect((await request(app).get('/friends').set(authHeader(aliceToken))).body.friends).toHaveLength(1);
  });

  it('refuses to add yourself and a missing user', async () => {
    const { user, token } = await createUser();
    const self = await request(app).post('/friends').set(authHeader(token)).send({ userId: user.id });
    expect(self.status).toBe(400);

    const missing = await request(app)
      .post('/friends')
      .set(authHeader(token))
      .send({ userId: '00000000-0000-0000-0000-000000000000' });
    expect(missing.status).toBe(404);
  });

  it('declines a request and removes a friend from both sides', async () => {
    const { user: alice, token: aliceToken } = await createUser();
    const { user: bob, token: bobToken } = await createUser();

    // Declining: Bob turns down the request Alice sent.
    await request(app).post('/friends').set(authHeader(aliceToken)).send({ userId: bob.id });
    const decline = await request(app).delete(`/friends/${alice.id}`).set(authHeader(bobToken));
    expect(decline.status).toBe(200);
    expect((await request(app).get('/friends/requests').set(authHeader(bobToken))).body.incoming).toHaveLength(0);

    // Removing: they become friends, then part ways.
    await request(app).post('/friends').set(authHeader(aliceToken)).send({ userId: bob.id });
    await request(app).post(`/friends/${alice.id}/accept`).set(authHeader(bobToken));
    expect((await request(app).get('/friends').set(authHeader(aliceToken))).body.friends).toHaveLength(1);

    const del = await request(app).delete(`/friends/${bob.id}`).set(authHeader(aliceToken));
    expect(del.status).toBe(200);
    expect((await request(app).get('/friends').set(authHeader(aliceToken))).body.friends).toHaveLength(0);
    expect((await request(app).get('/friends').set(authHeader(bobToken))).body.friends).toHaveLength(0);
  });

  it('filters the user list with a search', async () => {
    const { user: bob } = await createUser({ displayName: 'Bob Searchable' });
    const { token } = await createUser();

    const res = await request(app).get('/users?q=searchable').set(authHeader(token));
    expect(res.body.users.map((u) => u.id)).toContain(bob.id);
  });

  it('refuses friend requests from a visitor', async () => {
    const { user: bob } = await createUser();
    const { token: visitorToken } = await createUser({ isGuest: true });

    const res = await request(app).post('/friends').set(authHeader(visitorToken)).send({ userId: bob.id });
    expect(res.status).toBe(403);
    expect((await request(app).get('/friends').set(authHeader(visitorToken))).body.friends).toHaveLength(0);
  });

  it('refuses adding a visitor as a friend', async () => {
    const { token: aliceToken } = await createUser();
    const { user: visitor } = await createUser({ isGuest: true });

    const res = await request(app).post('/friends').set(authHeader(aliceToken)).send({ userId: visitor.id });
    expect(res.status).toBe(400);
  });

  it('marks visitors in the user list so the app can hide the friend button', async () => {
    const { token } = await createUser();
    const { user: visitor } = await createUser({ isGuest: true });

    const res = await request(app).get('/users').set(authHeader(token));
    const found = res.body.users.find((u) => u.id === visitor.id);
    expect(found.isGuest).toBe(true);
    expect(found.passwordHash).toBeUndefined();
  });
});
