const express = require('express');
const prisma = require('../lib/prisma');
const { HttpError } = require('../lib/httpError');
const { validateMessage, validateDirectChat, validateNewGroup, isAllowedImage } = require('../lib/validators');
const { messageTicks, previewText } = require('../lib/format');
const { requireAuth } = require('../middleware/auth');
const { singleImage, anyFile } = require('../middleware/upload');
const { saveImage, saveFile } = require('../lib/storage');
const { PUBLIC_USER_SELECT, withPresence } = require('../lib/userSelect');
const { joinGlobalChannel } = require('../lib/globalChannel');

const router = express.Router();

const SENDER_SELECT = { id: true, username: true, displayName: true, avatarColor: true, avatarUrl: true };

// Stops anyone who is not a member from reading or posting.
async function requireMember(conversationId, userId) {
  const membership = await prisma.member.findUnique({
    where: { userId_conversationId: { userId, conversationId } },
    select: { userId: true },
  });
  if (!membership) throw new HttpError(403, 'You are not in this conversation');
}

function formatMessage(message, viewerId) {
  return { ...message, ticks: messageTicks(message, viewerId) };
}

router.get('/conversations', requireAuth, async (req, res, next) => {
  try {
    const me = req.user.id;
    // Existing users land in the global channel the first time they load their chat list.
    await joinGlobalChannel(me);
    const conversations = await prisma.conversation.findMany({
      where: { members: { some: { userId: me } } },
      include: {
        members: { include: { user: { select: PUBLIC_USER_SELECT } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    // One grouped query counts unread messages for every chat at once.
    const unreadRows = await prisma.message.groupBy({
      by: ['conversationId'],
      where: { conversationId: { in: conversations.map((c) => c.id) }, senderId: { not: me }, readAt: null },
      _count: { _all: true },
    });
    const unreadByChat = new Map(unreadRows.map((r) => [r.conversationId, r._count._all]));

    const result = conversations.map((c) => {
      const last = c.messages[0] || null;
      return {
        id: c.id,
        isGroup: c.isGroup,
        isGlobal: c.isGlobal,
        name: c.name,
        createdAt: c.createdAt,
        members: c.members.map((m) => withPresence(m.user)),
        lastMessage: last ? { text: previewText(last), createdAt: last.createdAt, senderId: last.senderId } : null,
        updatedAt: last ? last.createdAt : c.createdAt,
        unreadCount: unreadByChat.get(c.id) || 0,
      };
    });

    result.sort((a, b) => Number(b.isGlobal) - Number(a.isGlobal) || new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ conversations: result });
  } catch (err) {
    next(err);
  }
});

// Body { userId } starts a 1-to-1 chat (or returns the existing one).
// Body { name, memberIds } creates a group that includes the creator.
router.post('/conversations', requireAuth, async (req, res, next) => {
  try {
    const me = req.user.id;
    const isGroup = req.body && (req.body.name !== undefined || req.body.memberIds !== undefined);

    if (!isGroup) {
      const { errors, value } = validateDirectChat(req.body);
      if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields', errors);
      if (value.userId === me) throw new HttpError(400, 'You cannot start a chat with yourself');

      const other = await prisma.user.findUnique({ where: { id: value.userId }, select: { id: true } });
      if (!other) throw new HttpError(404, 'That person was not found');

      const candidates = await prisma.conversation.findMany({
        where: { isGroup: false, members: { some: { userId: me } } },
        select: { id: true, members: { select: { userId: true } } },
      });
      const existing = candidates.find(
        (c) =>
          c.members.length === 2 &&
          c.members.some((m) => m.userId === value.userId)
      );
      if (existing) return res.json({ id: existing.id, created: false });

      const created = await prisma.conversation.create({
        data: {
          isGroup: false,
          members: { create: [{ userId: me }, { userId: value.userId }] },
        },
        select: { id: true },
      });
      return res.status(201).json({ id: created.id, created: true });
    }

    const { errors, value } = validateNewGroup(req.body);
    if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields', errors);

    const ids = [...new Set([me, ...value.memberIds])];
    const found = await prisma.user.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new HttpError(400, 'Some of those people were not found');

    const group = await prisma.conversation.create({
      data: {
        isGroup: true,
        name: value.name,
        members: { create: ids.map((userId) => ({ userId })) },
      },
      select: { id: true, name: true },
    });
    res.status(201).json({ id: group.id, name: group.name, created: true });
  } catch (err) {
    next(err);
  }
});

// Returns the thread oldest first, and marks the other person's messages as read.
router.get('/conversations/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const me = req.user.id;
    const conversationId = req.params.id;
    await requireMember(conversationId, me);

    await prisma.message.updateMany({
      where: { conversationId, senderId: { not: me }, readAt: null },
      data: { readAt: new Date() },
    });

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: SENDER_SELECT } },
    });
    res.json({ messages: messages.map((m) => formatMessage(m, me)) });
  } catch (err) {
    next(err);
  }
});

router.post('/conversations/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const me = req.user.id;
    const conversationId = req.params.id;
    await requireMember(conversationId, me);

    const { errors, value } = validateMessage({ text: req.body && req.body.text, hasImage: false });
    if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields', errors);

    const message = await prisma.message.create({
      data: { conversationId, senderId: me, text: value.text },
      include: { sender: { select: SENDER_SELECT } },
    });
    res.status(201).json({ message: formatMessage(message, me) });
  } catch (err) {
    next(err);
  }
});

// Sends one image (form field "image"), with an optional caption in "text".
router.post('/conversations/:id/images', requireAuth, singleImage, async (req, res, next) => {
  try {
    const me = req.user.id;
    const conversationId = req.params.id;
    await requireMember(conversationId, me);

    if (!req.file) throw new HttpError(400, 'Choose an image to send', { image: 'Choose an image' });
    if (!isAllowedImage(req.file.mimetype, req.file.buffer)) {
      throw new HttpError(400, 'That file is not a real JPG, PNG, GIF or WebP image');
    }

    const { errors, value } = validateMessage({ text: req.body && req.body.text, hasImage: true });
    if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields', errors);

    const imageUrl = await saveImage(req.file.buffer, req.file.mimetype, 'chat');
    const message = await prisma.message.create({
      data: { conversationId, senderId: me, text: value.text || null, imageUrl },
      include: { sender: { select: SENDER_SELECT } },
    });
    res.status(201).json({ message: formatMessage(message, me) });
  } catch (err) {
    next(err);
  }
});

// Sends any type of file (form field "file"), with an optional caption in "text".
router.post('/conversations/:id/files', requireAuth, anyFile, async (req, res, next) => {
  try {
    const me = req.user.id;
    const conversationId = req.params.id;
    await requireMember(conversationId, me);

    if (!req.file) throw new HttpError(400, 'Choose a file to send', { file: 'Choose a file' });

    const { errors, value } = validateMessage({ text: req.body && req.body.text, hasImage: true });
    if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields', errors);

    const saved = await saveFile(req.file.buffer, req.file.originalname, 'files');
    const message = await prisma.message.create({
      data: { conversationId, senderId: me, text: value.text || null, fileUrl: saved.url, fileName: saved.name },
      include: { sender: { select: SENDER_SELECT } },
    });
    res.status(201).json({ message: formatMessage(message, me) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
