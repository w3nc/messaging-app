const express = require('express');
const prisma = require('../lib/prisma');
const { HttpError } = require('../lib/httpError');
const { requireAuth } = require('../middleware/auth');
const { PUBLIC_USER_SELECT, withPresence } = require('../lib/userSelect');

const router = express.Router();

// Lists people, with a search box filter (?q=) and online status.
router.get('/users', requireAuth, async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.user.id },
        ...(q
          ? {
              OR: [
                { username: { contains: q.toLowerCase(), mode: 'insensitive' } },
                { displayName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: PUBLIC_USER_SELECT,
      orderBy: { displayName: 'asc' },
      take: 100,
    });
    res.json({ users: users.map((u) => withPresence(u)) });
  } catch (err) {
    next(err);
  }
});

// Accepted friends are stored both ways (A -> B and B -> A).
router.get('/friends', requireAuth, async (req, res, next) => {
  try {
    const rows = await prisma.friendship.findMany({
      where: { userId: req.user.id, status: 'accepted' },
      include: { friend: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ friends: rows.map((r) => withPresence(r.friend)) });
  } catch (err) {
    next(err);
  }
});

// Requests waiting for an answer, plus the ones this user has sent.
router.get('/friends/requests', requireAuth, async (req, res, next) => {
  try {
    const [incoming, outgoing] = await Promise.all([
      prisma.friendship.findMany({
        where: { friendId: req.user.id, status: 'pending' },
        include: { user: { select: PUBLIC_USER_SELECT } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendship.findMany({
        where: { userId: req.user.id, status: 'pending' },
        include: { friend: { select: PUBLIC_USER_SELECT } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({
      incoming: incoming.map((r) => withPresence(r.user)),
      outgoing: outgoing.map((r) => withPresence(r.friend)),
    });
  } catch (err) {
    next(err);
  }
});

// Sending the request. If that person already invited us, this accepts it instead.
router.post('/friends', requireAuth, async (req, res, next) => {
  try {
    if (req.user.isGuest) throw new HttpError(403, 'Create an account to add friends');
    const friendId = req.body && typeof req.body.userId === 'string' ? req.body.userId : '';
    if (!friendId) {
      throw new HttpError(400, 'Choose someone to add', { userId: 'Choose someone to add' });
    }
    if (friendId === req.user.id) throw new HttpError(400, 'You cannot add yourself');

    const other = await prisma.user.findUnique({
      where: { id: friendId },
      select: { id: true, isGuest: true },
    });
    if (!other) throw new HttpError(404, 'That person was not found');
    // A visitor's account is temporary, so it cannot keep friends.
    if (other.isGuest) {
      throw new HttpError(400, 'That person is only visiting. Friends need an account.');
    }

    const alreadyFriends = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: req.user.id, friendId } },
      select: { status: true },
    });
    if (alreadyFriends && alreadyFriends.status === 'accepted') {
      return res.json({ status: 'accepted' });
    }

    // They asked first: answer their request and become friends straight away.
    const theirs = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: friendId, friendId: req.user.id } },
      select: { status: true },
    });
    if (theirs && theirs.status === 'pending') {
      await acceptRequest(req.user.id, friendId);
      return res.json({ status: 'accepted' });
    }

    await prisma.friendship.upsert({
      where: { userId_friendId: { userId: req.user.id, friendId } },
      create: { userId: req.user.id, friendId, status: 'pending' },
      update: { status: 'pending' },
    });
    res.status(201).json({ status: 'pending' });
  } catch (err) {
    next(err);
  }
});

// Accepting a request that the other person sent.
router.post('/friends/:id/accept', requireAuth, async (req, res, next) => {
  try {
    const pending = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: req.params.id, friendId: req.user.id } },
      select: { status: true },
    });
    if (!pending || pending.status !== 'pending') {
      throw new HttpError(404, 'That request is no longer waiting');
    }
    await acceptRequest(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Removing a friend, and also used to decline or cancel a request.
router.delete('/friends/:id', requireAuth, async (req, res, next) => {
  try {
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: req.user.id, friendId: req.params.id },
          { userId: req.params.id, friendId: req.user.id },
        ],
      },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Writes both directions as accepted, dropping whatever request rows were there.
async function acceptRequest(myId, otherId) {
  await prisma.$transaction([
    prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId: myId, friendId: otherId },
          { userId: otherId, friendId: myId },
        ],
      },
    }),
    prisma.friendship.create({ data: { userId: myId, friendId: otherId, status: 'accepted' } }),
    prisma.friendship.create({ data: { userId: otherId, friendId: myId, status: 'accepted' } }),
  ]);
}

module.exports = router;
