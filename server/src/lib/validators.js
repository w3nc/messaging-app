// Pure input checks. No database here, so they are easy to unit test.
// Each validator returns { errors, value }: errors maps a field name to a message.

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HEX_COLOUR_RE = /^#[0-9a-f]{6}$/i;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_GROUP_MEMBERS = 50;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function emailProblem(email) {
  if (!EMAIL_RE.test(email) || email.length > 254) return 'Enter a valid email address';
  return null;
}

function validateSignup(body) {
  const input = body || {};
  const errors = {};
  const username = clean(input.username).toLowerCase();
  const email = clean(input.email).toLowerCase();
  const password = typeof input.password === 'string' ? input.password : '';
  const displayName = clean(input.displayName) || username;

  if (!USERNAME_RE.test(username)) errors.username = 'Use 3-20 letters, numbers, _ or .';
  const emailError = emailProblem(email);
  if (emailError) errors.email = emailError;
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    errors.password = 'Password must be 8-72 characters';
  }
  if (displayName.length > 40) errors.displayName = 'Display name must be 40 characters or fewer';

  return { errors, value: { username, email, password, displayName } };
}

function validateLogin(body) {
  const input = body || {};
  const errors = {};
  const email = clean(input.email).toLowerCase();
  const password = typeof input.password === 'string' ? input.password : '';
  const remember = input.remember === true || input.remember === 'true';

  const emailError = emailProblem(email);
  if (emailError) errors.email = emailError;
  if (!password) errors.password = 'Enter your password';

  return { errors, value: { email, password, remember } };
}

// Only the fields that are present in the body are checked and returned.
function validateProfile(body) {
  const input = body || {};
  const errors = {};
  const value = {};

  if ('displayName' in input) {
    const v = clean(input.displayName);
    if (!v || v.length > 40) errors.displayName = 'Display name must be 1-40 characters';
    else value.displayName = v;
  }
  if ('username' in input) {
    const v = clean(input.username).toLowerCase();
    if (!USERNAME_RE.test(v)) errors.username = 'Use 3-20 letters, numbers, _ or .';
    else value.username = v;
  }
  if ('title' in input) {
    const v = clean(input.title);
    if (v.length > 60) errors.title = 'Job title must be 60 characters or fewer';
    else value.title = v;
  }
  if ('bio' in input) {
    const v = clean(input.bio);
    if (v.length > 160) errors.bio = 'Bio must be 160 characters or fewer';
    else value.bio = v;
  }
  if ('email' in input) {
    const v = clean(input.email).toLowerCase();
    const emailError = emailProblem(v);
    if (emailError) errors.email = emailError;
    else value.email = v;
  }
  if ('avatarColor' in input) {
    const v = typeof input.avatarColor === 'string' ? input.avatarColor : '';
    if (!HEX_COLOUR_RE.test(v)) errors.avatarColor = 'Pick a valid colour';
    else value.avatarColor = v.toLowerCase();
  }
  if ('appearOnline' in input) {
    if (typeof input.appearOnline !== 'boolean') errors.appearOnline = 'Must be true or false';
    else value.appearOnline = input.appearOnline;
  }

  return { errors, value };
}

function validateMessage({ text, hasImage }) {
  const errors = {};
  const value = clean(text);
  if (value.length > MAX_MESSAGE_LENGTH) {
    errors.text = `Messages can be ${MAX_MESSAGE_LENGTH} characters or fewer`;
  } else if (!value && !hasImage) {
    errors.text = 'Write a message or attach an image';
  }
  return { errors, value: { text: value } };
}

function cleanIdList(list) {
  if (!Array.isArray(list)) return null;
  const ids = [...new Set(list.map((id) => clean(id)).filter(Boolean))];
  if (ids.length === 0 || ids.length > MAX_GROUP_MEMBERS) return null;
  return ids;
}

function validateDirectChat(body) {
  const userId = clean((body || {}).userId);
  if (!userId) return { errors: { userId: 'Choose someone to chat with' }, value: {} };
  return { errors: {}, value: { userId } };
}

function validateNewGroup(body) {
  const input = body || {};
  const errors = {};
  const name = clean(input.name);
  const memberIds = cleanIdList(input.memberIds);

  if (!name || name.length > 60) errors.name = 'Group name must be 1-60 characters';
  if (!memberIds) errors.memberIds = 'Add at least one other person';

  return { errors, value: { name, memberIds: memberIds || [] } };
}

function validateMemberIds(body) {
  const userIds = cleanIdList((body || {}).userIds);
  if (!userIds) return { errors: { userIds: 'Choose at least one person to add' }, value: {} };
  return { errors: {}, value: { userIds } };
}

// Looks at the first bytes of a file (its "magic numbers") to find the real image type.
// A renamed text file cannot fake these bytes.
function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  const head = buffer.subarray(0, 6).toString('ascii');
  if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function isAllowedImage(mimetype, buffer) {
  const detected = detectImageType(buffer);
  return Boolean(detected) && ALLOWED_IMAGE_TYPES.includes(mimetype) && detected === mimetype;
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_TYPES,
  validateSignup,
  validateLogin,
  validateProfile,
  validateMessage,
  validateDirectChat,
  validateNewGroup,
  validateMemberIds,
  detectImageType,
  isAllowedImage,
};
