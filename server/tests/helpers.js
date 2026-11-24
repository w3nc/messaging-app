// Shared test helpers: reset the database, create users and conversations, sign tokens.
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');
const { signToken } = require('../src/lib/token');

// Children first, so foreign keys never block the delete.
async function resetDatabase() {
  await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.member.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.friendship.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

let counter = 0;

// Creates a user straight in the database and returns it with a ready-to-use token.
async function createUser(overrides = {}) {
  counter += 1;
  const tag = `${Date.now().toString(36)}${counter}`;
  const password = overrides.password || 'password123';
  const user = await prisma.user.create({
    data: {
      username: overrides.username || `user_${tag}`,
      email: overrides.email || `user_${tag}@example.com`,
      passwordHash: await bcrypt.hash(password, 4),
      displayName: overrides.displayName || `Test User ${counter}`,
      title: overrides.title ?? '',
      bio: overrides.bio ?? '',
      avatarColor: overrides.avatarColor || '#0f8b7c',
      lastSeen: overrides.lastSeen || new Date(),
      appearOnline: overrides.appearOnline ?? true,
      isGuest: overrides.isGuest ?? false,
    },
  });
  const token = signToken(user.id, { remember: false });
  return { user, token, password };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

// Creates a one-to-one chat (or a group when isGroup is true) between the given users.
async function createConversation(users, { isGroup = false, name = null } = {}) {
  return prisma.conversation.create({
    data: {
      isGroup,
      name,
      members: { create: users.map((u) => ({ userId: u.id })) },
    },
  });
}

module.exports = { resetDatabase, createUser, authHeader, createConversation };
