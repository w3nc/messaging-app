const { COOKIE_NAME } = require('../middleware/auth');

// In production the site and the API are on different domains, so the cookie must be
// SameSite=None and Secure. In development plain Lax works on localhost.
function cookieOptions(remember) {
  const isProd = process.env.NODE_ENV === 'production';
  const options = { httpOnly: true, sameSite: isProd ? 'none' : 'lax', secure: isProd, path: '/' };
  if (remember) options.maxAge = 30 * 24 * 60 * 60 * 1000;
  return options;
}

function setAuthCookie(res, token, remember) {
  res.cookie(COOKIE_NAME, token, cookieOptions(remember));
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions(false));
}

module.exports = { setAuthCookie, clearAuthCookie };
