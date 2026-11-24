// Talks to the Quickchat API. Sends the sign-in token as a Bearer header
// and also the httpOnly cookie (credentials: 'include').

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'qc_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
}

export function storeToken(token, remember) {
  clearStoredToken();
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

// Photos saved on the server come back as /uploads/... paths. Those must be
// loaded from the API address, not from the page's own address.
export function mediaUrl(url) {
  if (!url) return url;
  return url.startsWith('/') ? `${BASE}${url}` : url;
}

export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form; // browser sets the multipart boundary itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: payload,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || data.message || 'Something went wrong. Try again.', res.status, data.details);
  }
  return data;
}

export const api = {
  signup: (body) => request('/auth/signup', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  continueAsGuest: (body) => request('/auth/guest', { method: 'POST', body: body || {} }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/me'),
  updateMe: (body) => request('/me', { method: 'PATCH', body }),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append('image', file);
    return request('/me/avatar', { method: 'POST', form });
  },
  removeAvatar: () => request('/me/avatar', { method: 'DELETE' }),
  conversations: () => request('/conversations'),
  openDirect: (userId) => request('/conversations', { method: 'POST', body: { userId } }),
  createGroup: (name, memberIds) => request('/conversations', { method: 'POST', body: { name, memberIds } }),
  messages: (id) => request(`/conversations/${id}/messages`),
  sendText: (id, text) => request(`/conversations/${id}/messages`, { method: 'POST', body: { text } }),
  sendImage: (id, file, text) => {
    const form = new FormData();
    form.append('image', file);
    if (text) form.append('text', text);
    return request(`/conversations/${id}/images`, { method: 'POST', form });
  },
  sendFile: (id, file, text) => {
    const form = new FormData();
    form.append('file', file);
    if (text) form.append('text', text);
    return request(`/conversations/${id}/files`, { method: 'POST', form });
  },
  users: (q = '') => request(`/users?q=${encodeURIComponent(q)}`),
  friends: () => request('/friends'),
  friendRequests: () => request('/friends/requests'),
  addFriend: (userId) => request('/friends', { method: 'POST', body: { userId } }),
  acceptFriend: (id) => request(`/friends/${id}/accept`, { method: 'POST' }),
  removeFriend: (id) => request(`/friends/${id}`, { method: 'DELETE' }),
};
