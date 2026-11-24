const { isOnline } = require('./format');

// Fields safe to send to any signed-in user. Never includes passwordHash.
const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  title: true,
  bio: true,
  avatarUrl: true,
  avatarColor: true,
  lastSeen: true,
  appearOnline: true,
  // Visitors ("Stay logged out") are shown in lists too, so the app needs to know
  // who they are: they cannot be added as friends.
  isGuest: true,
};

// Fields for the owner of the account (adds email and the guest flag).
const OWN_USER_SELECT = { ...PUBLIC_USER_SELECT, email: true, createdAt: true };

function withPresence(user, now = Date.now()) {
  return { ...user, online: isOnline(user.lastSeen, now, user.appearOnline) };
}

module.exports = { PUBLIC_USER_SELECT, OWN_USER_SELECT, withPresence };
