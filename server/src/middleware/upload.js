const multer = require('multer');
const { HttpError } = require('../lib/httpError');
const { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } = require('../lib/validators');

// Keeps the file in memory (req.file.buffer), then checks it and saves it.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new HttpError(400, 'Only JPG, PNG, GIF or WebP images are allowed'));
    }
    return cb(null, true);
  },
});

// Reads one image from the form field called "image". Skips non-form requests.
const singleImage = upload.single('image');

// Reads any one file from the form field "file" (chat attachments only, 10 MB max).
const anyFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
}).single('file');

module.exports = { singleImage, anyFile };
