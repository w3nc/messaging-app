const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { HttpError } = require('../lib/httpError');
const { validateSignup, validateLogin } = require('../lib/validators');
const { signToken } = require('../lib/token');
const { setAuthCookie, clearAuthCookie } = require('../lib/authCookie');
const { requireAuth, readToken } = require('../middleware/auth');
const { OWN_USER_SELECT, withPresence } = require('../lib/userSelect');
const { joinGlobalChannel } = require('../lib/globalChannel');

const router = express.Router();

// A fixed hash to compare against when the email is unknown, so timing does not reveal accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/auth/signup', async (req, res, next) => {
  try {
    const { errors, value } = validateSignup(req.body);
    if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields', errors);

    const taken = await prisma.user.findFirst({
      where: { OR: [{ email: value.email }, { username: value.username }] },
      select: { email: true, username: true },
    });
    if (taken) {
      const field = taken.email === value.email ? 'email' : 'username';
      throw new HttpError(409, `That ${field} is already taken`, { [field]: 'Already taken' });
    }

    const passwordHash = await bcrypt.hash(value.password, 10);
    const user = await prisma.user.create({
      data: {
        username: value.username,
        email: value.email,
        passwordHash,
        displayName: value.displayName,
      },
      select: OWN_USER_SELECT,
    });

    await joinGlobalChannel(user.id);

    const token = signToken(user.id);
    setAuthCookie(res, token, false);
    res.status(201).json({ token, user: withPresence(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const { errors, value } = validateLogin(req.body);
    if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields', errors);

    const user = await prisma.user.findUnique({ where: { email: value.email } });
    const match = await bcrypt.compare(value.password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !match) throw new HttpError(401, 'Incorrect email or password. Try again.');

    const token = signToken(user.id, { remember: value.remember });
    setAuthCookie(res, token, value.remember);

    const { passwordHash, ...safe } = user;
    res.json({ token, user: withPresence(safe) });
  } catch (err) {
    next(err);
  }
});

// "Stay logged out": creates a visitor account. It has a real id, so chats and messages work,
// but a visitor cannot edit a profile (see PATCH /me).
router.post('/auth/guest', async (req, res, next) => {
  try {
    const tag = crypto.randomBytes(4).toString('hex');
    const user = await prisma.user.create({
      data: {
        username: `visitor_${tag}`,
        email: `visitor_${tag}@guest.quickchat.local`,
        // Random, so nobody can ever sign in to this visitor account with a password.
        passwordHash: await bcrypt.hash(crypto.randomUUID(), 10),
        displayName: `Visitor ${tag}`,
        isGuest: true,
      },
      select: OWN_USER_SELECT,
    });

    await joinGlobalChannel(user.id);

    const token = signToken(user.id, { remember: false });
    setAuthCookie(res, token, false);
    res.status(201).json({ token, user: withPresence(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: withPresence(req.user) });
});

module.exports = router;
