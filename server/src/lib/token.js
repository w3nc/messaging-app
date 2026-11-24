const jwt = require('jsonwebtoken');

function secret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing in server/.env');
  return process.env.JWT_SECRET;
}

// "Keep me signed in" gives a 30-day token; otherwise the token lasts one day.
function signToken(userId, { remember = false } = {}) {
  return jwt.sign({ sub: userId }, secret(), { expiresIn: remember ? '30d' : '1d' });
}

// Throws if the token is bad or expired.
function verifyToken(token) {
  return jwt.verify(token, secret());
}

module.exports = { signToken, verifyToken };
