// Pure helpers for presence, unread counts, ticks and previews. No database here.

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const PREVIEW_MAX = 60;

// Online if the person was seen in the last two minutes and has not hidden their status.
function isOnline(lastSeen, now = Date.now(), appearOnline = true) {
  if (!appearOnline || !lastSeen) return false;
  const seen = new Date(lastSeen).getTime();
  if (Number.isNaN(seen)) return false;
  return now - seen <= ONLINE_WINDOW_MS;
}

// Messages from other people that this viewer has not read yet.
function countUnread(messages, viewerId) {
  return (messages || []).filter((m) => m.senderId !== viewerId && !m.readAt).length;
}

// Ticks shown under my own messages: one tick = sent, two blue ticks = seen.
function messageTicks(message, viewerId) {
  if (!message || message.senderId !== viewerId) return null;
  return message.readAt ? 'seen' : 'sent';
}

// Short line for the chat list, like "Photo" or the first part of the text.
function previewText(message, max = PREVIEW_MAX) {
  if (!message) return 'No messages yet';
  if (!message.text && message.imageUrl) return 'Photo';
  const text = (message.text || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

module.exports = { ONLINE_WINDOW_MS, isOnline, countUnread, messageTicks, previewText };
