const express = require('express');
const prisma = require('../lib/prisma');
const { HttpError } = require('../lib/httpError');
const { validateProfile, isAllowedImage } = require('../lib/validators');
const { requireAuth } = require('../middleware/auth');
const { singleImage } = require('../middleware/upload');
const { saveImage } = require('../lib/storage');
const { OWN_USER_SELECT, withPresence } = require('../lib/userSelect');

const router = express.Router();

// Only the signed-in user can change their own profile.
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    if (req.user.isGuest) throw new HttpError(403, 'Create an account to edit your profile');
    const { errors, value } = validateProfile(req.body);
    if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields', errors);

    if (value.username && value.username !== req.user.username) {
      const taken = await prisma.user.findUnique({ where: { username: value.username }, select: { id: true } });
      if (taken) throw new HttpError(409, 'That username is already taken', { username: 'Already taken' });
    }
    if (value.email && value.email !== req.user.email) {
      const taken = await prisma.user.findUnique({ where: { email: value.email }, select: { id: true } });
      if (taken) throw new HttpError(409, 'That email is already taken', { email: 'Already taken' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: value,
      select: OWN_USER_SELECT,
    });
    res.json({ user: withPresence(user) });
  } catch (err) {
    next(err);
  }
});

// Uploads a profile picture (form field "image"). Replaces the colour circle with the photo.
router.post('/me/avatar', requireAuth, singleImage, async (req, res, next) => {
  try {
    if (req.user.isGuest) throw new HttpError(403, 'Create an account to change your photo');
    if (!req.file) throw new HttpError(400, 'Choose an image to upload', { image: 'Choose an image' });
    if (!isAllowedImage(req.file.mimetype, req.file.buffer)) {
      throw new HttpError(400, 'That file is not a real JPG, PNG, GIF or WebP image');
    }

    const avatarUrl = await saveImage(req.file.buffer, req.file.mimetype, 'avatars');
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl },
      select: OWN_USER_SELECT,
    });
    res.json({ user: withPresence(user) });
  } catch (err) {
    next(err);
  }
});

// Removes the profile photo, so the colour circle shows again.
router.delete('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    if (req.user.isGuest) throw new HttpError(403, 'Create an account to change your photo');
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: null },
      select: OWN_USER_SELECT,
    });
    res.json({ user: withPresence(user) });
  } catch (err) {
    next(err);
  }
});

// Anyone may look at a profile through the user list, but only the owner may edit it.
router.patch('/users/:id', requireAuth, (req, res, next) => {
  if (req.params.id !== req.user.id) {
    return next(new HttpError(403, 'You can only edit your own profile'));
  }
  next(new HttpError(404, 'Edit your profile at /me'));
});

module.exports = router;
