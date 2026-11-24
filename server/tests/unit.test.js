const { isOnline, countUnread, messageTicks, previewText, ONLINE_WINDOW_MS } = require('../src/lib/format');
const { validateSignup, validateLogin } = require('../src/lib/validators');

// Unit tests: pure functions only, no database and no server.

describe('isOnline (from lastSeen)', () => {
  const now = new Date('2025-01-01T12:00:00Z').getTime();

  it('is online when seen just now', () => {
    expect(isOnline(new Date(now - 1000), now, true)).toBe(true);
  });

  it('is offline after the two minute window', () => {
    expect(isOnline(new Date(now - ONLINE_WINDOW_MS - 1), now, true)).toBe(false);
  });

  it('is offline when the person hid their status', () => {
    expect(isOnline(new Date(now), now, false)).toBe(false);
  });

  it('is offline when lastSeen is missing or not a date', () => {
    expect(isOnline(null, now, true)).toBe(false);
    expect(isOnline('not a date', now, true)).toBe(false);
  });
});

describe('countUnread', () => {
  it('counts only other people\'s messages with no readAt', () => {
    const messages = [
      { senderId: 'bob', readAt: null },
      { senderId: 'bob', readAt: new Date() },
      { senderId: 'alice', readAt: null },
    ];
    expect(countUnread(messages, 'alice')).toBe(1);
  });

  it('returns 0 for an empty or missing list', () => {
    expect(countUnread([], 'alice')).toBe(0);
    expect(countUnread(undefined, 'alice')).toBe(0);
  });
});

describe('messageTicks', () => {
  it('shows sent for my message not yet read, and seen once read', () => {
    expect(messageTicks({ senderId: 'alice', readAt: null }, 'alice')).toBe('sent');
    expect(messageTicks({ senderId: 'alice', readAt: new Date() }, 'alice')).toBe('seen');
  });

  it('shows no ticks on messages from someone else', () => {
    expect(messageTicks({ senderId: 'bob', readAt: null }, 'alice')).toBeNull();
  });
});

describe('previewText', () => {
  it('says Photo for an image with no caption', () => {
    expect(previewText({ text: null, imageUrl: 'x.png' })).toBe('Photo');
  });

  it('collapses spaces and cuts long text with an ellipsis', () => {
    expect(previewText({ text: '  hello   there  ' })).toBe('hello there');
    const long = previewText({ text: 'a'.repeat(100) }, 10);
    expect(long).toHaveLength(10);
    expect(long.endsWith('…')).toBe(true);
  });

  it('says No messages yet when there is no message', () => {
    expect(previewText(null)).toBe('No messages yet');
  });
});

describe('validateSignup', () => {
  it('accepts a good sign-up and lowercases the username and email', () => {
    const { errors, value } = validateSignup({
      username: '  Alice_01 ',
      email: 'Alice@Example.com',
      password: 'longenough',
    });
    expect(errors).toEqual({});
    expect(value.username).toBe('alice_01');
    expect(value.email).toBe('alice@example.com');
  });

  it('rejects a short password and a bad username', () => {
    const { errors } = validateSignup({ username: 'a b', email: 'x@y.co', password: 'short' });
    expect(errors.username).toBeDefined();
    expect(errors.password).toBeDefined();
    expect(errors.email).toBeUndefined();
  });
});

describe('validateLogin', () => {
  it('requires a valid email and a password', () => {
    const { errors } = validateLogin({ email: 'nope', password: '' });
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
  });
});
