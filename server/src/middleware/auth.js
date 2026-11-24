const prisma = require('../lib/prisma');
const { verifyToken } = require('../lib/token');
const { HttpError } = require('../lib/httpError');
const { OWN_USER_SELECT } = require('../lib/userSelect');

const COOKIE_NAME = 'qc_token';
const LAST_SEEN_REFRESH_MS = 30 * 1000;

// The app sends a Bearer token; the httpOnly cookie is the fallback.
function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return (req.cookies && req.cookies[COOKIE_NAME]) || null;
}

async function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
    if (!token) throw new HttpError(401, 'Please sign in to continue');

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new HttpError(401, 'Your session has ended. Please sign in again');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: OWN_USER_SELECT });
    if (!user) throw new HttpError(401, 'Please sign in to continue');

    // Refresh "last seen" now and then, so the online dot stays correct.
    const now = new Date();
    if (now - new Date(user.lastSeen) > LAST_SEEN_REFRESH_MS) {
      await prisma.user.update({ where: { id: user.id }, data: { lastSeen: now } });
      user.lastSeen = now;
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, readToken, COOKIE_NAME };
