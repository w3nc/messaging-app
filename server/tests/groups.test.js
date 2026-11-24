const request = require('supertest');
const app = require('../src/app');
const { createUser, authHeader, createConversation } = require('./helpers');

describe('group chats', () => {
  it('creates a group with a name and members, and includes the creator', async () => {
    const { user: bob } = await createUser();
    const { user: cara } = await createUser();
    const { user: alice, token } = await createUser();

    const res = await request(app)
      .post('/conversations')
      .set(authHeader(token))
      .send({ name: 'Study buddies', memberIds: [bob.id, cara.id] });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Study buddies');

    const list = await request(app).get('/conversations').set(authHeader(token));
    const group = list.body.conversations.find((c) => c.id === res.body.id);
    expect(group.isGroup).toBe(true);
    expect(group.members.map((m) => m.id).sort()).toEqual([alice.id, bob.id, cara.id].sort());
  });

  it('lets any member post, and shows the message to everyone in the group', async () => {
    const { user: bob, token: bobToken } = await createUser();
    const { user: cara, token: caraToken } = await createUser();
    const { user: alice, token } = await createUser();

    const created = await request(app)
      .post('/conversations')
      .set(authHeader(token))
      .send({ name: 'Trio', memberIds: [bob.id, cara.id] });

    await request(app)
      .post(`/conversations/${created.body.id}/messages`)
      .set(authHeader(bobToken))
      .send({ text: 'Hello group' });

    const caraView = await request(app)
      .get(`/conversations/${created.body.id}/messages`)
      .set(authHeader(caraToken));
    expect(caraView.body.messages[0].text).toBe('Hello group');
  });

  it('requires a name for a group', async () => {
    const { user: bob } = await createUser();
    const { token } = await createUser();
    const res = await request(app)
      .post('/conversations')
      .set(authHeader(token))
      .send({ name: '', memberIds: [bob.id] });
    expect(res.status).toBe(400);
  });

  it('does not let a non-member see the group', async () => {
    const { user: bob } = await createUser();
    const { user: cara } = await createUser();
    const { token: outsider } = await createUser();
    const { user: alice, token } = await createUser();

    const created = await request(app)
      .post('/conversations')
      .set(authHeader(token))
      .send({ name: 'Private', memberIds: [bob.id, cara.id] });

    const res = await request(app)
      .get(`/conversations/${created.body.id}/messages`)
      .set(authHeader(outsider));
    expect(res.status).toBe(403);
  });
});
