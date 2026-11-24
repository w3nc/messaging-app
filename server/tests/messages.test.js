const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const { createUser, authHeader, createConversation } = require('./helpers');

describe('POST /conversations (1-to-1)', () => {
  it('creates a direct chat and returns the same one on a second call', async () => {
    const { user: bob } = await createUser();
    const { token } = await createUser();

    const first = await request(app).post('/conversations').set(authHeader(token)).send({ userId: bob.id });
    expect(first.status).toBe(201);
    expect(first.body.created).toBe(true);

    const second = await request(app).post('/conversations').set(authHeader(token)).send({ userId: bob.id });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
  });

  it('refuses a chat with yourself', async () => {
    const { user, token } = await createUser();
    const res = await request(app).post('/conversations').set(authHeader(token)).send({ userId: user.id });
    expect(res.status).toBe(400);
  });
});

describe('messages', () => {
  it('sends a message and lists it oldest first', async () => {
    const { user: bob } = await createUser();
    const { user: alice, token } = await createUser();
    const convo = await createConversation([alice, bob]);

    const sent = await request(app)
      .post(`/conversations/${convo.id}/messages`)
      .set(authHeader(token))
      .send({ text: '  Hi Bob  ' });
    expect(sent.status).toBe(201);
    expect(sent.body.message.text).toBe('Hi Bob');
    expect(sent.body.message.ticks).toBe('sent');

    const list = await request(app).get(`/conversations/${convo.id}/messages`).set(authHeader(token));
    expect(list.status).toBe(200);
    expect(list.body.messages).toHaveLength(1);
  });

  it('rejects an empty message with 400', async () => {
    const { user: bob } = await createUser();
    const { user: alice, token } = await createUser();
    const convo = await createConversation([alice, bob]);

    const res = await request(app)
      .post(`/conversations/${convo.id}/messages`)
      .set(authHeader(token))
      .send({ text: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.details.text).toBeDefined();
  });

  it('marks the other person\'s messages as read when the thread is opened', async () => {
    const { user: bob, token: bobToken } = await createUser();
    const { user: alice, token: aliceToken } = await createUser();
    const convo = await createConversation([alice, bob]);

    await request(app)
      .post(`/conversations/${convo.id}/messages`)
      .set(authHeader(aliceToken))
      .send({ text: 'Ping' });

    const bobView = await request(app).get(`/conversations/${convo.id}/messages`).set(authHeader(bobToken));
    expect(bobView.body.messages[0].readAt).not.toBeNull();

    const aliceView = await request(app).get(`/conversations/${convo.id}/messages`).set(authHeader(aliceToken));
    expect(aliceView.body.messages[0].ticks).toBe('seen');
  });

  it('returns 403 to someone who is not a member', async () => {
    const { user: bob } = await createUser();
    const { user: alice } = await createUser();
    const { token: outsider } = await createUser();
    const convo = await createConversation([alice, bob]);

    const list = await request(app).get(`/conversations/${convo.id}/messages`).set(authHeader(outsider));
    expect(list.status).toBe(403);

    const post = await request(app)
      .post(`/conversations/${convo.id}/messages`)
      .set(authHeader(outsider))
      .send({ text: 'Let me in' });
    expect(post.status).toBe(403);
  });
});

describe('GET /conversations', () => {
  it('shows the unread count from the other person only', async () => {
    const { user: bob, token: bobToken } = await createUser();
    const { user: alice, token: aliceToken } = await createUser();
    const convo = await createConversation([alice, bob]);

    await prisma.message.createMany({
      data: [
        { conversationId: convo.id, senderId: bob.id, text: 'one' },
        { conversationId: convo.id, senderId: bob.id, text: 'two' },
        { conversationId: convo.id, senderId: alice.id, text: 'mine' },
      ],
    });

    const aliceList = await request(app).get('/conversations').set(authHeader(aliceToken));
    expect(aliceList.body.conversations.find((c) => c.id === convo.id).unreadCount).toBe(2);

    await request(app).get(`/conversations/${convo.id}/messages`).set(authHeader(aliceToken));
    const after = await request(app).get('/conversations').set(authHeader(aliceToken));
    expect(after.body.conversations.find((c) => c.id === convo.id).unreadCount).toBe(0);

    const bobList = await request(app).get('/conversations').set(authHeader(bobToken));
    expect(bobList.body.conversations.find((c) => c.id === convo.id).unreadCount).toBe(1);
  });
});
